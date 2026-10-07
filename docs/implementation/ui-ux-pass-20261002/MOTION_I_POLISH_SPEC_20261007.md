# Pokret i doterivanje: benchmark i specifikacija (7. oktobar 2026)

Agent za dizajn-benchmark (Sonnet 5.5, nasleđeno od roditelja). **Samo specifikacija:** nijedan izvorni fajl, uređaj, DEV baza ni zavisnost nisu dotaknuti; ovo je jedini novi fajl.

Čitano stanje: stablo `USKOCI-CLEAN-spoj-20261006`, HEAD `5727d89b` (7.10. 18:22) uz oko 400 nekomitovanih izmena drugih agenata. `fajl:red` važi za čitanje oko 21:30 i može da se pomeri. Putanje u tabelama su relativne na `src/` (osim ako piše drugačije).

Oznake: **[K]** pročitano u kodu · **[Sn]** stvarno preuzet izvor iz odeljka F · **[R]** izračunao autor (zatvorena formula ili skeniranje koda, nije mereno na uređaju) · **[P]** predlog autora · **[?]** ne može se proveriti bez telefona ili emulatora.

Pravila koja ovaj dokument ne dira: AGENTS.md 3.6 (bele površine, crn tekst, jedna zelena radnja, tekst najmanje 12, bez odskoka, Lottie samo za likove i trenutke, `expo-blur` odobren, nova zavisnost samo uz odobrenje), `sys.motion` R1–R8 (`ui/system/tokens.ts:198-291`), jedan izvor za "smanji pokret" (`ui/system/motion.ts`), predlog od 7.10. (O pokreti prstom, I prozori, P filteri i zum, G porodica kartica, F pretraga), B22 (`docs/implementation/product-v1-closure-20260926/finalization-20260927/B22_REANIMATED_PATCH_20261002.md`) i UX plan po ekranima (`UX_PLAN_PO_EKRANIMA_20261007.md` 2.9).

## 0. Rezime

Osnova je neobično dobra: osam pravila, jedna lestvica tokena, ratchet test koji hvata nove literale, jedan izvor za smanjen pokret, `Press`/`Appear`/paneli na UI niti i B22 zakrpa. Do "svetske klase" ne fali još pokreta nego **doslednost, haptika i prvi utisak**. Pet nalaza po uticaju:

- **N1. Prelaz napred, najčešći pokret u aplikaciji, nema svoju krivu, a postoje dve porodice.** `PUSH_TRANSITION` daje samo `duration: 280` (`app/(app)/_layout.tsx:31-32`), bez `easing`; RN tada koristi `Easing.inOut(Easing.ease)` (`node_modules/react-native/Libraries/Animated/animations/TimingAnimation.js:77`) [K]. [R] U prvih 10 % vremena pređe 3 % puta (naša `easeOut` 40 %), a 90 % puta tek na 81 % vremena (naša na 36 %). To krši R2 ("UI nikad ne ulazi sporo") i preporuku da ulaz bude ease-out [S18]. Ekrani na korenu (`dogovor/[id]`, `obavestenja`, `prijave`) idu drugim putem: nativni `slide_from_right`, 100 % širine, sistemsko `config_mediumAnimTime` (`node_modules/react-native-screens/android/src/main/res/base/anim/rns_slide_in_from_right.xml`) [K]. Dve geometrije i dva ritma za isti pojam "napred". Popravka: M-01 (S), pa odluka D2.
- **N2. Haptika je jedan ton, i to onaj koji Android ne preporučuje.** Oko 160 od oko 180 `haptic` svojstava je `select` (88 %) [R], i na navigacionim karticama; `error` ne postoji nigde; držanje mikrofona u Dogovoru nema haptiku [K]. Na Androidu su `selectionAsync/impactAsync/notificationAsync` talasni oblici `Vibrator`-a (`node_modules/expo-haptics/android/src/main/java/expo/modules/haptics/HapticsModule.kt:54-60`), a instalirani `expo-haptics` 57.0.2 sam kaže da treba koristiti `performAndroidHapticsAsync`, koji zove `View.performHapticFeedback` sa sistemskim konstantama (`Haptics.d.ts`, `HapticsModule.kt:44-51`) [K, S7]. Android princip: "less is more", jačina prema važnosti, predefinisane konstante, haptika sinhrona sa slikom [S6]. Popravka bez zavisnosti: tanak omotač, M-03.
- **N3. Prvo učitavanje nema "dolazak".** `useAppear` ima opciju `afterLoading` (`ui/system/Appear.tsx:31`), ali nijedan ekran je ne prosleđuje [K]: skelet prelazi u listu bez pokreta, iako R6 kaže da hladno učitavanje stiže jednom. Skelet Početne je statičan (`ui/home/HomePresentation.tsx:192`). Tokeni `tab`, `fade`, `arrive`, `loop`, `easeInOut`, `sheet` i `springSheet` postoje samo u testovima [K]. Popravka: M-02 (S).
- **N4. Nova pretraga animira visinu na JS niti.** `Collapsible` (`ui/v2/discovery/Collapsible.tsx:65,70`, `useNativeDriver: false`) otvara jedan i zatvara drugi odeljak istovremeno pri automatskom prelasku, a `SearchSheet` visinu panela pomera JS oprugom (`SearchSheet.tsx:88`). Layout svojstva su skupa klasa i native driver ih ne nosi [S20, S25]; Expo merenje na Moto G8 Plus: već 10 animiranih pogleda košta 5–7 ms po kadru UI niti [S30]. Dva mesta sa visinom na JS niti: `Collapsible` (izričit izuzetak od R1, vlasnik 7.10.) i visina panela; pre promene treba izmeriti (M-08), ne pogađati.
- **N5. Stanja i kontrast imaju sitne rupe koje oko hvata.** Zeleni tekst `#00845A` na neutralnoj podlozi pada ispod 4,5:1 (na `greenSoft` 4,25) [R]: izabrani razlog `CancelReasons.tsx:44-45` (13 px) i značka u `Segmented.tsx:119-120` (12 px) [K]. Ivica polja `#CDCDCD` je 1,59:1 prema belom (WCAG traži 3:1 gde ivica identifikuje kontrolu) [R, S15]. "Onemogućeno" je zatamnjeno na četiri načina (0,45/0,5/0,55/0,65) iako sistem kaže "siva, nikad bleda" [K]. `SuccessMark` koristi oprugu ζ 0,47 sa preskokom 19 % puta [R] i tik na t=0 dok se znak još ne vidi.

**Odluke vlasnika** (detalj u E): D1 Dogovor chat ostaje bez pokreta (preporuka) ili dozvoljavamo jedan. D2 jedna porodica prelaza napred i da li korenski tabovi dobijaju fade 150 ms. D3 uspeh bez preskoka ili jedan namerni "pop" samo u trenucima. D4 tik na navigacionim karticama ili tišina (proba na HONOR u prozoru "sad"). D5 visina u pretrazi ostaje JS izuzetak ili prelazi na UI nit, posle merenja. D6 smanjen pokret: ostaje "trenutno" (R7) ili kratak dissolve za pokrete sa značenjem. D7 resursi: Lottie fajlovi za "Dogovoreno!" i likove (vlasnikovi; plaćeni se odobravaju pojedinačno), eksperiment sa Reanimated fleg-om. **Nijedna nova zavisnost nije potrebna za talase 1 i 2.**

**Nisam mogao da proverim:** (1) ništa nije mereno na uređaju: svi troškovi kadra potiču iz dokumentacije i čitanja koda, opruge su izračunate zatvorenom formulom (stvarno smirenje u Reanimated-u zavisi i od `energyThreshold`); (2) nijedan haptički obrazac nije osetjen, mapiranje na Android konstante je hipoteza; (3) Apple HIG (motion, haptics), m3.material.io, Uber Base, Airbnb Medium, Android Authority su vratili samo naslov ili 403/404, pa nema prvostepenih podataka o pokretu za Airbnb, Uber, Revolut i Wise (F.2); (4) smer prelaza u `(app)` navigatoru je zaključak iz koda [?]; (5) frekvencija osvežavanja HONOR-a nije u dokumentima [?].

## A. Jezik pokreta za USKOČI

### A0. Već odlučeno (ne otvarati ponovo)

- Bez odskoka na panelima i dijalozima; panel odozdo se smiruje oko 340 ms, zatvara 170–180; dijalog ulazi 0,96 → 1 za 200 ms; kratka potvrda je dijalog, uspeh je traka "Poruka", nikad dva prozora (predlog I, `ui/system/ConfirmSheet.tsx`, `Poruka.tsx`).
- Šest pokreta prstom, svaki i kao dugme: povuci nadole zatvara, prevuci ulevo/udesno prebacuje Aktivni/Istorija i nedelje, prevuci red ulevo = jedna radnja, povuci na vrhu = osveži, povuci listu = visina (predlog O).
- Detalj ulazi 240 ms; kontinuitet daje **ista glava**, ne prelaz sa zajedničkim elementom (predlog G2, UX plan 2.11, B22).
- Izabran pin 1,06× sa narandžastom ivicom; kartica na mapi ostaje ispod detalja (predlog E2).
- Pretraga: pozadina se zamuti, panel se smiri bez odskoka, odeljci jedan po jedan, izbor sam otvara sledeći (predlog F; `ui/v2/discovery/*`).
- Dogovor chat (1:1) ne pomera ništa sam od sebe; svaki programski skrol skače; test to zaključava (`ui/messages/__tests__/conversation-has-no-motion.test.ts:17`) [K].
- Nikad se ne animiraju iznos, broj, vreme ni reč stanja (`ui/system/tokens.ts:201-206`).

### A1. Šta kaže benchmark i koliko mu se veruje

| Izvor | Šta stvarno stoji | Težina | Šta uzimamo |
|---|---|---|---|
| Material 3, Android dokumentacija i tokeni [S1, S2] | 16 trajanja 50–1000 ms; standard (0,2, 0, 0, 1), decelerate (0, 0, 0, 1), accelerate (0,3, 0, 1, 1); "trajanje raste sa površinom i putanjom"; container transform 300 ulaz / 250 izlaz; shared axis i fade through 300; fade 150 / 75 | visoka (zvanično) | naš opseg 120–360 je unutra; odnos izlaz/ulaz 0,67 leži između fade (0,5) i container (0,83) |
| Android Compose opruge [S3] | dampingRatio 1,0 = bez odskoka; opruga čuva brzinu kad se cilj promeni usred pokreta, tween ne | visoka | prst nosi opruga, naredba timing |
| Apple WWDC18 "Designing Fluid Interfaces" (transkript na trećoj strani) [S4] | odgovor odmah, prekidivo, podrazumevano 100 % prigušenje, preskok samo ako gest ima zamah, prst i sadržaj zajedno | visoka (Apple sesija) | P1, P4; nema odskoka bez zamaha |
| Apple kriterijum smanjenog pokreta [S5] | skaliranje, vrtenje, periferno kretanje, paralaksa i **animirani blur** izazivaju muku; ako pokret nosi značenje, zameniti ga dissolve/highlight/bojom, ne brisati | visoka | A6, D6 |
| Thumbtack Thumbprint [S33] | 6 trajanja 75–350 ms, ease-out (0, 0, 0,4, 1), "quick but not jarring", preporuka da se koriste stock animacije platforme radi doslednosti | visoka (marketplace zadataka, prvostepeno) | potvrđuje opseg i argument za jednu porodicu prelaza (N1) |
| Linear [S34] | poravnanje labela/ikona/dugmadi, manje vizuelnog šuma, kontrast; bez podataka o pokretu | srednja za doterivanje, nula za pokret | odeljak C |
| Airbnb [S35, S36] | zvanično samo "dimensional and beautifully animated interface"; animirane 3D ikone u sopstvenom video-formatu (sekundarno) | niska | animacija umetnosti samo kao trenutak ili lik (naše Lottie pravilo) |
| Wise [S37], Revolut [S38] | Wise: dotLottie šabloni za objašnjenja (vendor); Revolut: "one thing at a time gets attention", niz kontrole blur, traka se spusti, kartica raste, pa sheet (agencija) | niska | P6 i redosled za "Dogovoreno!" |
| Gemini [S39, S40] | pilula-kompozitor; Live: talasni oblik u pilulji, kamera/ekran levo, mute desno, dugme transkripta, izlaz tastaturom ili back gestom; pulsirajući gradijent pozadine (štampa) | srednja | `PillComposer` i `VoiceMode` već prate; gradijent pozadine NE (bele površine) |
| Uber Base, Apple HIG motion/haptics, m3.material.io, Airbnb Medium | nedostupni (samo naslov, 403, 404) | nema | ništa se ne tvrdi |

### A2. Načela

| # | Načelo | Oslonac | U USKOČI |
|---|---|---|---|
| P1 | Odgovor pre lepote: prva vidljiva reakcija na dodir najviše 100 ms | 0,1 s je "trenutno" [S19]; "everything needs to respond instantly" [S4] | dugme reaguje u istom kadru (`pressDelayFor` = 0), red i kartica posle `PRESS_DELAY` 60 ms da skrol ne trza (`ui/Press.tsx:23-36`) |
| P2 | Kreću se samo `transform` i `opacity` | layout svojstva su skupa klasa, native driver ih ne nosi [S20, S25] | R1; izuzeci su imenovani i mereni (N4) |
| P3 | Ulaz duži od izlaza; ulaz usporava, izlaz brzo odlazi | M3 container 300/250, fade 150/75 [S1]; NN/g 300 prema 200–250 [S18] | 240/160 |
| P4 | Što nosi prst: opruga bez odskoka. Što naredi dugme: kratak timing | 100 % prigušenje osim uz zamah [S4]; opruga čuva brzinu pri prekidu [S3] | `sheetSpring` + clamp, `sheetClose` 170 |
| P5 | Činjenice se ne animiraju, kontejneri da | `tokens.ts:201-206` | iznos, vreme, broj i reč stanja ulaze gotovi |
| P6 | Jedan glavni pokret po trenutku | [S38] (agencija); 10 animiranih pogleda 5–7 ms po kadru na Moto G8 Plus [S30] | 1 glavni + najviše 2 prateća, najviše 6 redova, najviše 4 petlje |
| P7 | Kontinuitet = ista glava, ne zajednički element | predlog G2; Reanimated pri smanjenom pokretu izostavlja shared prelaze i exiting [S24]; B22 | ne uvoditi shared element prelaze |
| P8 | Smanjen pokret ukida kretanje, ne informaciju | [S5], WCAG 2.3.3 [S17] | R7 (+ opcija D6) |

### A3. Tokeni (sve vrednosti su `sys.motion.*`; stupac "Predlog" menja samo ono što piše)

| Uloga | Token · vrednost | Kriva ili opruga | Mehanizam | Smanjen pokret | Predlog |
|---|---|---|---|---|---|
| Prst dole | `press` 120 ms | `easeOut` | Reanimated `withTiming` u `usePressLift` | bez skale, haptika ostaje | zadržati; red/kartica čekaju 60 ms |
| Prst gore | `spring` {duration 400, ζ 0,85} | opruga | Reanimated `withSpring` | odmah 1 | [R] preskok 0,6 % od 3 % hoda, nevidljiv; ζ = 1 je doslovno "bez odskoka" (nizak prioritet) |
| Prekidač, čip, segment, caret | `toggle` 180 ms | `easeOut` | RN `Animated`, native driver | odmah | zadržati |
| Ulaz sadržaja (red, traka, panel) | `enter` 240 ms | `easeOut` | `Appear` / RN `Animated` | bez | zadržati |
| Izlaz | `exit` 160 ms | `easeOut` | RN `Animated` | bez | zadržati |
| Korak između redova | `stagger` 40 ms, najviše 6 redova | – | `Appear.delay` | bez | zadržati; šest redova gotovo za 440 ms, najduže 480 ms jer je zakašnjenje ograničeno na 6 × 40 [R]; NN/g: na 500 ms animacija je "teret" [S18] |
| Prelaz napred | `push` 280 ms, **bez krive** | RN podrazumevano inOut | bottom-tabs `transitionSpec` | `animation: 'none'` | **240 ms + `easeOut` eksplicitno** (M-01); nazad 200 [P] |
| Prelaz korenskog taba | `tab` 150 ms (neiskorišćen) | – | `animation: 'none'` | – | trenutno (plan); opcija fade 150 (D2) |
| Utapanje skelet → sadržaj | `fade` 160 ms (neiskorišćen) | `easeOut` | – | – | samo ako `afterLoading` nije dovoljan |
| Kamera | `camera` 360 ms; zum dugme 180 | `easeOut` | MapLibre `easeTo` / `zoomTo` | skok | zadržati |
| Panel odozdo | `sheetSpring` k300 c30 m1, clamp | ζ 0,87, smirenje oko 270 ms do 2 %, oko 350 ms do 0,5 % [R] | Gorhom + Reanimated | `{duration: 0}` | zadržati |
| Zatvaranje naredbom | `sheetClose` 170 ms | `easeOut` | `close(config)` | odmah | zadržati |
| Dijalog | `dialog` 200 ms, 0,96 → 1 | `easeOut` | RN `Animated` + prozorski fade sistema | bez | zadržati |
| Petlje | `loop` 700 / 520 / 1600 ms | quad in-out | RN `Animated` | stoje | zadržati; komponente još pišu literale (`Arrive.tsx`, `AiConversationShell.tsx`) |
| Dolazak ilustracije | `arrive` 800 ms | (0,22, 0,8, 0,25, 1) | RN `Animated` | bez | `Arrive` nije ni na jednom ekranu: upotrebiti za `Calm`/prazna stanja ili obrisati |
| Uspeh | `SuccessMark` k240 c13 m0,8 | ζ 0,47, preskok 19 % hoda (0,6 → vrh 1,075), smirenje oko 490 ms [R] | RN `Animated.spring` | skok, tik ostaje | c ≈ 25: ζ 0,90, bez preskoka, oko 255 ms [R] (D3) |

Krive [R]: naša `easeOut` (0,23, 1, 0,32, 1) dostiže 90 % puta za 36 % vremena, kao M3 emphasized-decelerate (0,05, 0,7, 0,1, 1), a naglije od M3 standard-decelerate (52 %) [S1, S2]. Izlaz takođe ide `easeOut`; M3 za izlaz koristi accelerate [S2], NN/g kaže da ease-in izlaz može delovati trom [S18]: zadržati `easeOut` za izlaze do 200 ms.

**Najviše istovremeno**

| Granica | Vrednost | Oslonac |
|---|---|---|
| Reanimated pogleda po redu liste | najviše 2; ulaz samo za nov id, najviše 6 redova | R4 |
| Reanimated komponenti ukupno | najviše 100 na slabom Androidu | [S20] |
| Petlje odjednom | najviše 4 (R4); [P] najviše 2 uz mapu | R4 |
| Jednokratni pokreti na ekranu | [P] 1 glavni + najviše 2 prateća (npr. panel + pozadina + kontrole) | P6 |
| Cena stalnih animacija | 10 pogleda: RN Animated 5,1 ms, Reanimated 7,3 ms po kadru; 50 pogleda 8,8 / 10,6 ms (Moto G8 Plus, release, loop `translateX`) | [S30] |

### A4. Asimetrija ulaz / izlaz

| Površina | Ulaz | Izlaz | Odnos | Napomena |
|---|---|---|---|---|
| Panel odozdo | opruga oko 270–350 | 170 | oko 0,5–0,6 | M3 container 0,83, fade 0,5 [S1] |
| Dijalog | 200 + prozorski fade | sistemski fade | – | izlaz ne vodi JS (testovi traže odmah nestajanje) |
| Traka "Poruka" | 240 | 160 | 0,67 | 4 s / 6 s sa radnjom |
| Odeljak pretrage | 240 | 160 | 0,67 | JS visina (N4) |
| Pilula "Mapa" | 240 | 160 | 0,67 | Reanimated layout, protiv R4 |
| Prelaz napred / nazad | 280 / 280 | – | 1,0 | [P] 240 / 200 |

### A5. Dodir, fokus, onemogućeno

- Lestvica skale pritiska: 0,97 dugme, 0,985 red i kartica, 1 velika površina (R8). Danas literali: 29 × `0.99`, 2 × `0.986` (`CandidateFace.tsx`), 2 × `0.97`, plus `CARD_PRESS_SCALE = 0.986` u `TaskCard.tsx:20` [R]. [P] Jedan odgovor: ili `0.99` postaje četvrta imenovana stepenica, ili se svodi na 0,985; vizuelna razlika je ispod 2 dp na kartici od 361 dp.
- Kod za "pritisni i pusti" kartice postoji u četiri kopije (`v2/TaskCard.tsx:86-90`, `v2/OwnTaskCard.tsx:63-67`, `v2/ApplicationFace.tsx:161-164`, `agreements/AgreementListCard.tsx:51-55`) iako `usePressLift` postoji; M-07.
- Red ili meta bez skale (`scaleTo={1}`) unutar kartice nema sopstveni pritisnut izgled jer okvir nosi skalu: ostaje tako.
- Onemogućeno: siva podloga + `muted` tekst, bez providnosti (već pravilo u `ActionSheet`/`ConfirmSheet`); danas 0,45 / 0,5 / 0,55 / 0,65 na osam mesta u sedam fajlova (`auth/AuthControls.tsx`, `auth/AccountClosingState.tsx`, `auth/AuthIntentLine.tsx`, `product/ProductDetails.tsx` ×2, `system/PickerTile.tsx`, `v2/TaskCard.tsx`, `media/AgreementVoiceControls.tsx`) [K].
- Fokus polja: ivica `ink` 1,5 px (kontrast najmanje 3:1 [S15]); vidljiv stil fokusa nađen je u 2 (`auth/AuthControls.tsx`, `reviews/ReviewCommentField.tsx`) od oko 34 upotrebe `TextInput`, a sistemski `field` token ga nema [K, R]. `AgreementChat` i AI shell prate fokus, a njegov stil nisam proverio [?].
- Meta najmanje 44 dp (`sys.touch.min`), u panelima 48; razmak najmanje 8 dp [S12, S13, S14].

### A6. Haptika: mapa događaja

Pravila: tik je ishod, ne dodir (R5); nikad na dodir navigacije, nikad tokom skrola ili panovanja; između dva tika najmanje 120 ms [P]; sinhrono sa slikom, ne ispred nje [S6]; greške progutati (`Press.fire` danas ne hvata odbijeno obećanje, `Poruka` i `SuccessMark` hvataju). Haptika ostaje i pri smanjenom pokretu (R5). Mapiranje na Android konstante je **hipoteza za probu na HONOR** [P, ?]; konstante postoje u instaliranom `expo-haptics` [K, S7]; `Segment_Tick` i `Toggle_*` traže noviji Android, pa omotač mora imati rezervu (`select` → `impactAsync(Light)`).

| Događaj | Nivo · iOS / podrazumevano | Android (omotač) | Danas |
|---|---|---|---|
| Navigacija: tab, nazad, otvaranje kartice ili reda | T0 tišina (D4) | – | tab i nazad tihi; kartice i redovi `select` na otpuštanju |
| Promena izbora: čip, segment, checkbox/radio, stepper, zvezdica, dan u kalendaru | T1 `selectionAsync` | `Segment_Tick` | `select` (oko 160 mesta), preko Vibrator simulacije |
| Prekidač | T1 `selectionAsync` | `Toggle_On` / `Toggle_Off` | sistemski `Switch` |
| Glavna radnja na otpuštanju (Pošalji, Objavi, Potvrdi, Sačuvaj) | T2 `impactAsync(Light)` | `Virtual_Key` | `light` u `V2Action` primary i slanju |
| Razorna potvrda (Obriši, Otkaži, Odbaci izmene) | T3 `impactAsync(Medium)` | `Long_Press` | `medium` (`ConfirmSheet`, `ActionSheet`, `ProductSheet`) |
| Ishod potvrđen sa servera (Poruka confirmed, Objavljeno, Dogovoreno!) | T4 `notificationAsync(Success)` | `Confirm` | da (`Poruka.tsx:95`, `SuccessMark.tsx:27`), ali na t=0 pre nego što se znak vidi: [P] tik na prvom dostizanju (oko 120–150 ms) |
| Neuspeh komande (slanje, snimak, objava, offline blokada) | T5 `notificationAsync(Error)` | `Reject` | **nigde** |
| Držanje mikrofona: snimanje zaista počelo / otpušteno za slanje / otkazano povlačenjem | `impactAsync(Light)` / `impactAsync(Light)` / `notificationAsync(Warning)` | `Gesture_Start` / `Gesture_End` / `Reject` | **nema** (`media/AgreementVoiceControls.tsx:45-78`) |
| Panel liste sleće na zaustavnu tačku (spuštena / pola / puna) | T1, jednom po sletanju | `Segment_Tick` | samo na dodir rukohvata |
| Prevlačenje reda prelazi prag otvaranja | T1, jednom | `Segment_Tick` | `haptic="none"` (`notifications/SwipeToRead.tsx`) |
| Dugi pritisak koji pokreće radnju | – | `Long_Press` | – |
| Skrol, pan mape, kucanje | nikad | – | – |

## B. Pokret po ekranima

Legenda: RNA = RN `Animated`, native driver; RNR = Reanimated; RM = smanjen pokret; rizik kadra N / S / V (nizak / srednji / visok). "Danas": da / delimično / ne. Obuhvaćeno je samo ono što ekran radi pokretom ili namerno ne radi.

### B1. Početna

| Okidač | Element i mehanizam | Vreme · kriva | RM | Rizik | Danas |
|---|---|---|---|---|---|
| Otvaranje, topli povratak | ništa se ne kreće; sadržaj stoji | – | – | N | da: baseline u `useAppear.settle` (`ui/home/HomePresentation.tsx:227-235`) |
| Prvo učitavanje | skelet diše, pa prvi redovi "Čeka te" ulaze jednom (`Appear`, `afterLoading`) | 240 + 40 po redu (najviše 6), `easeOut` | bez | N | **ne:** skelet je statičan (`:192`), `afterLoading` niko ne šalje (`:228`) |
| Nov red dok gledaš | `Appear` samo za nov id | 240 | bez | N | da (`:269,297`) |
| Dodir pločice ili reda | `Press` skala 0,985 (pločice), 0,99 literal (redovi) | 120 + opruga | bez skale, haptika ostaje | N | da (`:64,74,94,130,162`); 0,99 van lestvice |
| Povuci za osvežavanje | nativni `RefreshControl`, zeleni krug | sistem | sistem | N | da (`:253`); pilula "Upravo" iz predloga O6: ne |
| Brojevi ("3 aktivna · 1 nacrt") | bez animacije | – | – | – | da |

### B2. Zadaci (mapa i lista)

| Okidač | Element i mehanizam | Vreme · kriva | RM | Rizik | Danas |
|---|---|---|---|---|---|
| Visina liste (spuštena / pola / puna): prevlačenje ili dodir rukohvata | Gorhom `BottomSheet`, `sheetSpring`, bez over-draga; zum i "U blizini" voze se na UI niti iz `animatedPosition` (shared value → `useAnimatedStyle`) | oko 270–350 ms [R], opruga | `{duration: 0}` | S (lista + mapa + 3 stila; B22 sonda P1 nikad pokrenuta) | da: `ui/v2/discovery/DiscoveryListSheet.tsx:49-60`, `discovery/mapControls.ts:21-53` |
| Čipovi preko mape ↔ čipovi u zaglavlju liste | opacity + translate iz pozicije liste, prva trećina hoda | prati prst | – | N | da (`ui/v2/DiscoveryPresentation.tsx:655-659`) |
| Zum + / − | `camera.zoomTo(next, {duration: toggle})` | 180 ms | skok | N (MapLibre nativ) | da (`ui/v2/DiscoveryMap.tsx:365`) |
| Izbor pina | halo i 1,06× su bitmapa `ViewAnnotation` (`refresh()`), menja se odjednom; kamera `easeTo` do čiste trake; kartica izlazi na `sheetSpring` | kamera 360, `easeOut` | skok | S | delimično: kamera i kartica da, sam pin odjednom (`discovery/PricePill.tsx:15`, `DiscoveryMap.tsx:250-253`); EX-03d halo 85/91 ms [K, doc] |
| Povuci karticu nadole, ×, Back | `PeekSheet` pan-down-close; naredba 170 `easeOut`; Back zatvara karticu pre ekrana | opruga / 170 | odmah | N | da (`ui/system/PeekSheet.tsx:50-66`) |
| Pilula "Mapa" na punoj visini | RNR `entering FadeIn` / `exiting FadeOut` (layout animacije) | 240 / 160 | bez | S (B22 klasa) | da, ali protivno R4 (`DiscoveryPresentation.tsx:1304-1305`); M-06 |
| Povuci za osvežavanje | nativni `RefreshControl`, samo na punoj visini | sistem | sistem | N | da (`:1281`) |
| Nov zadatak na vrhu | `Appear` za nov id; pilula "N novih zadataka" iz predloga P | 240 | bez | N | `Appear` da (`:173`); pilula **ne** |

### B3. Pretraga (panel)

| Okidač | Element i mehanizam | Vreme · kriva | RM | Rizik | Danas |
|---|---|---|---|---|---|
| Otvaranje | pozadina opacity 0 → 1 (RNA; `BlurView` intenzitet 35, rezerva zatamnjenje za Android ispod 12 i iOS "reduce transparency"), panel `translateY` opruga (RNA) | 240 `easeOut` / `sheetSpring` | bez, blur statičan | S (blur + offscreen alfa) | da: `ui/v2/discovery/SearchSheet.tsx:72-80`, `SearchBackdrop.tsx:73-77` |
| Zatvaranje | `translateY` + fade, timing, zaštitni timer | 170 | odmah | N | da (`SearchSheet.tsx:94-107`) |
| Otvaranje ili zatvaranje odeljka | `Collapsible`: visina okvira JS drajverom, telo apsolutno dok se kreće; caret RNA 180 | 240 / 160 `easeOut` | pojavi / nestane | **V** (JS nit, raspored po kadru; izuzetak od R1, vlasnik 7.10.) | da: `discovery/Collapsible.tsx:27-91`, `system/Disclosure.tsx:52-66` |
| Automatski prelaz na sledeći odeljak | zatvara trenutni, otvara sledeći, `scrollTo` animiran | 240 + 160 istovremeno | bez | **V** (dve visine + skrol) | da: `DiscoverySearchPanel.tsx:173-210` |
| Panel do pune visine (lista mesta) | `Animated.spring(height)` sa `useNativeDriver: false` + radijus uglova interpolacijom (JS) | oko 270–350 | odmah | **V** | da: `SearchSheet.tsx:88,109-111` |
| "Prikaži N zadataka" | menja se samo tekst; broj ne klizi | – | – | – | da |

### B4. Dogovori

| Okidač | Element i mehanizam | Vreme · kriva | RM | Rizik | Danas |
|---|---|---|---|---|---|
| Ulazak liste | `Appear` samo za nov id; segment ili filter ne igra | 240 + 40 po redu | bez | N | da (`ui/agreements/AgreementListCard.tsx:121-127`, `ui/v2/AgreementCollectionPresentation.tsx:81-82`); posle skeleta ne |
| Dodir kartice | okvir se skalira kao jedan objekat, 0,986 literal, četvrta kopija koda | 120 + opruga | bez skale | N | da (`AgreementListCard.tsx:51-55`) |
| Promena koraka u traci | tačka 0,6 → 1 kad se stanje promeni dok gledaš (UX plan 2.9) | 240 | odmah | N | **ne:** `ui/agreements/AgreementSteps.tsx` je statičan |
| Meni "···" | `ProductSheet` na `sheetSpring`; izabrana radnja se izvršava tek posle zatvaranja | opruga / 170 | odmah | N | da (`ui/system/ActionSheet.tsx:46-48`) |
| Prevuci ulevo/udesno Aktivni ↔ Istorija (O2) | kapsula prati prst | prati prst | – | S | **ne** (nema ni jednog pan hvatača u listi) |
| Otvaranje Dogovora | root `Stack` nativni `slide_from_right`, trajanje sistemsko | sistem | `'none'` | N (UI nit) | da (`app/_layout.tsx:143`); drugi ritam od `(app)` pushova (N1) |
| Pregled ↔ Poruke (tab u Dogovoru) | uslovni render | – | – | – | bez prelaza (`app/dogovor/[id].tsx:505`) |

### B5. Raspored

| Okidač | Element i mehanizam | Vreme · kriva | RM | Rizik | Danas |
|---|---|---|---|---|---|
| Prevlačenje nedelje | `PanResponder`, odluka na otpuštanju, bez praćenja prsta; promena odmah | – | – | N | da, namerno statično (`ui/calendar/weekSwipe.ts:10`); opcija M-10: dissolve 160 liste ispod |
| Promena dana | stanje; lista ispod menja se odmah, izabrani dan puni zeleno bez prelaza | – | – | N | da (odmah) |
| Strelice nedelje | `ChromeIconButton`, `select` | – | – | N | da (`AgendaScreen.tsx:188-189`) |
| Mesečni prozor | `ProductSheet` | opruga / 170 | odmah | N | da (`MonthSheet.tsx:73`) |

### B6. Obaveštenja

| Okidač | Element i mehanizam | Vreme · kriva | RM | Rizik | Danas |
|---|---|---|---|---|---|
| Prevuci red ulevo ("Pročitano") | RNGH `Swipeable` (klasa nad RN Animated), `sheetSpring` bez bounciness; RM: ista opruga 40× kruća, ne nula | prati prst + oko 300 | skoro odmah | S | da (`ui/notifications/SwipeToRead.tsx:3,28,48`); `Swipeable` je `@deprecated` u RNGH 2.32 (`node_modules/react-native-gesture-handler/src/components/Swipeable.tsx:226`) [K] |
| Označi sve | dugme sa spinerom u sebi; redovi postaju pročitani odjednom; "Poruka" potvrđena sa tikom | – | – | N | da (`InboxPresentation.tsx:226`, `app/obavestenja.tsx:95`) |
| Učitavanje | `StateView` skelet `plain` ×5, diše | 700 | stoji | N | da (`InboxPresentation.tsx:233`) |
| Nov red | `Appear` samo za nov id | 240 | bez | N | da (`:260`) |

### B7. Moji zadaci i Moje prijave

| Okidač | Element i mehanizam | Vreme · kriva | RM | Rizik | Danas |
|---|---|---|---|---|---|
| Promena stanja kartice (Objavljen → Bira se · 3) | čip i tekst se menjaju u mestu | – | – | – | da (pravilo činjenica) |
| Novi red | `Appear` | 240 | bez | N | da (`ui/v2/MarketplacePresentation.tsx:65,139`) |
| Segmenti Aktivni / Nacrti / Istorija | indikator `translateX` (RNA) | 180 `easeOut` | odmah | N | da (`ui/system/Segmented.tsx:39-54`) |
| Potvrda (obriši, otkaži) | dijalog 0,96 → 1 + prozorski fade; dugme ima spiner; `SLOW_COMMAND_MS` 2500 | 200 | bez | N | da (`ui/system/ConfirmSheet.tsx:173-218`) |
| Prevuci red ulevo = "Obriši" (O5) | `Swipeable` + traka "Vrati" | prati prst | – | S | **ne** |
| Filteri | `ProductSheet` | opruga / 170 | odmah | N | da (`MarketplacePresentation.tsx:209`) |

### B8. Trenutak "Objavljeno"

| Okidač | Element i mehanizam | Vreme · kriva | RM | Rizik | Danas |
|---|---|---|---|---|---|
| Server potvrdi objavu | `SuccessMark fresh`: skala 0,6 → 1 opruga + opacity 180 + `success` tik; reči stoje; 1,5 s, pa dalje (ili dugme; sa čitačem ekrana čeka) | oko 490 ms [R], opruga | skok + tik | N | da (`ui/objava/PublishedMoment.tsx:22,64`, `ui/system/SuccessMark.tsx:19-37`); preskok 19 % protivno "bez odskoka" (D3); tik na t=0 |

### B9. Dogovor chat

| Okidač | Element i mehanizam | Vreme · kriva | RM | Rizik | Danas |
|---|---|---|---|---|---|
| Nova poruka | nema animacije; skrol skače (`animated: false`); grupni razgovor koristi `Appear` | – | – | – | da, zaključano testom (`conversation-has-no-motion.test.ts:17`) |
| Slanje | `Press` `light` na otpuštanju; oznaka poslato → viđeno u konačnom obliku | – | – | N | da (`ui/AgreementChat.tsx:609`) |
| Snimanje glasa (drži) | mikrofon: `usePressLift` skala 0,97, nivo kao širina 40×6 dp, povlačenje nagore preko 70 dp otkazuje | 120 + opruga | bez skale | N | da, **bez haptike** (`ui/media/AgreementVoiceControls.tsx:45-78`) |
| Puštanje glasa | dugme Pauza / Preslušaj; napredak je širina u % | – | – | N | da |
| AI razgovor | `FadeInDown` samo za nove poruke (`useConversationArrival`), tačkice 520 ms, sjaj pilule prati nivo glasa | 240 / 520 / 1600 | bez / stoje / statično | S (Reanimated po poruci) | da (`ui/aiFirst/AiConversationShell.tsx:431-468`, `VoiceComposer.tsx:293-320`) |

Gemini referenca [S39, S40]: pilula, nivo glasa u pilulji, mute i transkript kao vidljive kontrole. Naš `VoiceMode` ima pilulu sa sjajem po nivou i pregled pre slanja; fali samo haptika na početak i kraj slušanja (M-03/M-04).

### B10. Tab i prelazi ruta

| Okidač | Element i mehanizam | Vreme · kriva | RM | Rizik | Danas |
|---|---|---|---|---|---|
| Prebacivanje korenskog taba | `animation: 'none'` | 0 | – | N | da (`app/(app)/_layout.tsx:183`); token `tab` 150 neiskorišćen |
| Gurnut ekran u `(app)` (oko 30 ekrana sa `FULL`) | bottom-tabs `shift`: opacity [-1,0,1] → [0,1,0] + `translateX` ±50 dp; `Animated.timing`, native driver (`BottomTabView.js:65,124`); 280 ms **bez krive** | 280, RN podrazumevano inOut | `'none'` (`_layout.tsx:157`) | S | da (`_layout.tsx:31-32`); N1 |
| Gurnut ekran na korenu (Dogovor, Obaveštenja, Prijave) | nativni `slide_from_right`, 100 % širine, `config_mediumAnimTime` | sistem | `'none'` (`app/_layout.tsx:143`) | N | da; drugačiji od gornjeg |
| Smer pomaka u `(app)` | `BottomTabView.js` računa smer iz **indeksa rute** (`index >= state.index ? 1 : -1`, linija 119), ne iz istorije; 41 ruta | – | – | ? | [?] snimiti 6 parova na emulatoru: napred u viši indeks, napred u niži, `replace` posle toka, nazad, tab → push, push → tab |

## C. Doterivanje: lista provere za reviewera

**Protokol hoda.** Emulator `USKOCI_V5_TEST` (AGENTS: 1264×2728, 560 dpi, font 1,15, Europe/Belgrade; README skripti u `b22/scripts` pominje 1080×2424 @480: proveriti `wm size`), snimci van repozitorijuma. Po ekranu: mirovanje, držanje pritiska na glavnoj meti (preko 400 ms), skelet, prazno i greška; font 1,0 / 1,15 / 1,3; širina 361 i 320 dp. Parovi za poređenje: kartica u listi ↔ kartica na mapi ↔ glava detalja; Dogovor kartica ↔ red u Rasporedu; "Poruka" ↔ dijalog. Smanjen pokret samo na emulatoru (`adb shell settings put global transition_animation_scale 0`, jer RN na Androidu to čita [S27]); telefon vlasnika se ne dira. Svaki nalaz: ekran, ID stavke, snimak, `fajl:red`, ozbiljnost (P1 blokira, P2 doteraj, P3 kasnije).

### C1. Razmak i ritam
- [ ] Samo `space` 4/8/12/16/20/24/32/48. Stanje [R]: 496 literala u 178 fajlova, 117 (24 %) van lestvice; najčešće 10 (×37), 6 (×28), 14 (×26), 3 (×6), 28 (×5). Najviše: `messages/MessageBubbles` (11), `aiFirst/AiConversationShell` (10), `v2/MarketplacePresentation` (9), `system/Detail` (9), `v2/TaskFace` (6), `system/Segmented` (6), `system/Skeleton` (5).
- [ ] [P] Dozvoljeni optički poluskokovi unutar komponente: 2, 6, 10, 14 (uz komentar); zabranjeno 3, 5, 7, 9, 13, 15, 17, 18.
- [ ] Gutter 16 na svakom korenskom ekranu; `cardCompact` (padding 16) u listama, `card` (20) za čitanje: jedna vrednost po klasi.
- [ ] Skelet ima mere buduće kartice (`Skeleton.tsx` koristi 15/14 koje su TaskCard mere van lestvice): preklopiti snimak skeleta i kartice, nema skoka.
- [ ] Srodno 8, između sekcija 24–32; "Moji zadaci / Moje prijave / Sačuvano" jedan ispod drugog bez velikog razmaka.

### C2. Tipografija
- [ ] Samo uloge `sys.type`. Literali `fontSize` [R]: 12, 13, 14, 15, 16, 17, 18, 20, 22, 23, 24, 26, 28, 30, 34; sumnjivi van uloga: 17 (×3), 22, 26, 34.
- [ ] Najmanje 12: skeniranje ne nalazi ispod 12.
- [ ] Naslov `TaskCard` (`s.title`, 18/24/-0,3) je literal jednak ulozi `heading`: koristiti token.
- [ ] Iznosi i brojevi `tabular-nums`; nepoznat iznos kaže "Iznos nije sačuvan", nikad "0 RSD".
- [ ] Font 1,3: nijedan naslov ne seče, dugme ne izlazi iz ekrana, širinu čita samo `useLayoutClass`.

### C3. Boja i kontrast [R, S15, S16]

| Par | Odnos | Prag | Stanje |
|---|---|---|---|
| `ink` #202020 / bela · `muted` #525252 / bela | 16,29 · 7,81 | 4,5 | ok |
| zelena #00845A / bela · bela / zelena (glavna radnja) | 4,72 | 4,5 | ok, tanka margina |
| zelena / `greenSoft` #F3F3F3 | **4,25** | 4,5 | pada za tekst (`CancelReasons.tsx:44-45`, `Segmented.tsx:119-120`) |
| zelena / `wash` · `iconWell` · `control` | 4,41 · 4,33 · **3,85** | 4,5 | pada za tekst; ikona 3:1 ok osim na `control` |
| `greenEdge` #226B52 / `greenSoft` | 5,75 | 4,5 | rešenje bez novog tokena: tekst na neutralnoj podlozi u `greenEdge` ili `ink` |
| `orangeInk` / bela · `onOrange` / narandžasta | 5,33 · 6,01 | 4,5 | ok; bela / narandžasta 2,61 nikad za tekst |
| `danger` / bela · bela / `danger` | 6,87 | 4,5 | ok |
| ivica polja `lineStrong` #CDCDCD / bela | **1,59** | 3 (1.4.11) | pada ako ivica jedina identifikuje polje; [P] #8F8F8F (3,23) ili ispuna polja, odluka dizajna |
| ivica kartice `line` #EBEBEB · `cardLine` #DEDEDE | 1,19 · 1,35 | – | dekor; razdvajanje nose oblik i senka |
| traka segmenata `control` / bela pilula | 1,23 | 3 za stanje | stanje nose i težina fonta i `ink` tekst (14,6) |

### C4. Površine, ivice, senke
- [ ] Jedna lestvica senki: `raisedItem` (kartica u listi), `floating`, `sheetLift.docked/detached`, `materialControl.raised/inset`; `elevation.*` u `theme/tokens.ts` je naslednik. Van `tokens.ts` ima 13 literala senke ili elevacije [R]: `Segmented` (6), `PricePill` (3), `TaskCard` (2), `TabBarItem` (2).
- [ ] Kartica u listi (`raisedItem`, ivica `line` #EBEBEB) ↔ kartica na mapi (`PeekSheet`, ivica `cardLine` #DEDEDE + `sheetLift.detached`) ↔ glava detalja: ista porodica, a ivice se razlikuju: izabrati jednu boju ivice (radijus 24 je već isti).
- [ ] Nikad kartica u kartici: `TaskCard bare` u Peek-u je u redu; proveriti `SearchSection` u panelu, činjenice u `AgreementActions`, `StateView` u kartici.
- [ ] Radijusi samo 12 / 24 / 28 / pill (+6 za checkbox): 21 literal, 8 van skale [R] (rukohvat 2 i 3, `AgreementVoiceControls` 18 ×2, 16, 6, 1).
- [ ] Rukohvat panela 40×4, Peek 36×4: uskladiti.
- [ ] Debljina ivice: `StyleSheet.hairlineWidth` na nekim, 1 na drugim: jedna vrednost.

### C5. Ikone
- [ ] [P] Lestvica 16 / 20 / 24 / 28 / 32 / 40 / 48 / 56 / 64. `FactArt` se piše u 15 veličina [R]: 24 (×51), 20 (×15), 32 (×14), 28 (×12), 18 (×8), 26 (×8), 22 (×7), 16 (×7), 14 (×2), 36 (×1), …; van lestvice 14, 18, 22, 26, 36 (oko 26 upotreba).
- [ ] `Glyph` 16 / 20 / 24 je u redu; direktni `phosphor-react-native` ostaje u 58 fajlova sa veličinama 13–28 (UX plan): selidba po timovima.
- [ ] Zdenac ikone po klasi: 28 (kartica), 32 (red Početne), 40 (ikone Početne): jedan.
- [ ] Ikona i prva linija teksta dele središnju liniju (`alignItems: 'center'` prema `flex-start` + `marginTop: 2`, npr. `SupportPresentation caseArt`).

### C6. Dodir i stanja kontrola
- [ ] Meta najmanje 44 dp, u panelima 48; 46 mesta ima `hitSlop={0}` gde vizuelna površina sama mora biti 44. Kandidati sa 32–40 dp: `media/PhotoAttachTiles` `removeCircle` 32, `aiFirst/AiConversationShell` `toolCircle` 40, `AgreementChat` `send` 40 [?] (stvarna meta zavisi od roditelja). Poznat izuzetak: dan u traci na 320 dp, 38 dp (`calendar/WeekStrip.tsx` komentar).
- [ ] Skala pritiska samo 0,97 / 0,985 / 1 (A5); onemogućeno = siva, ne providno; fokus polja vidljiv (A5).
- [ ] Poslata radnja ima spiner samo unutar dugmeta, a dugme je onemogućeno dok traje (R6).

### C7. Prazno, učitavanje, greška, offline
- [ ] `StateView` svuda: ilustracija 56 u zdencu 80, naslov `title`, jedna rečenica `copy`, jedna zelena i najviše jedna tiha radnja. Početna ima sopstveni `Skeleton` i `Unavailable`: uskladiti.
- [ ] Skelet ima oblik budućeg sadržaja (`SkeletonVariant`), diše kao celina (jedna petlja po listi), skriven je za čitač ekrana.
- [ ] Greška nikad ne izgleda kao "prazno" ("Deo pregleda trenutno nije učitan" naspram "Nema…").
- [ ] Skelet → sadržaj bez skoka rasporeda; hladno stiže jednom (N3), toplo miruje.
- [ ] Nepoznato nikad ne postaje "0" ni prazna lista.

### C8. Porodica kartica i ponovljeni elementi
- [ ] Redosled pin → kartica mape → kartica liste → detalj → prijava: naslov, vrednost, mesta, mesto i vreme, starost i objavljivač (predlog G); iste reči ("Prima ponude", "★ 4,8 · 12 ocena").
- [ ] Isti levi rub, razmak i avatar u svim karticama liste (Zadaci, Moji zadaci, Dogovori, Prijave); `StatusChip` isti u Dogovoru, Rasporedu i Arhivi.
- [ ] Jedna zelena glavna radnja po ekranu; narandžasto samo za pažnju; zum i "U blizini" uvek iznad liste (predlog P).
- [ ] Zaglavlje detalja ponavlja glavu kartice iz podataka liste; fotografije se uklapaju 180 ms kad stignu, bez skoka.

### C9. Pokret u hodu
- [ ] Nijedan iznos, broj ili vreme ne klizi; nijedna petlja van fokusa; nijedan `exiting`; ulaz samo za nove id.
- [ ] `Press` na tri mete: skala vidljiva pri držanju, vraća se, skrol sa kartice ne trza.
- [ ] RM uključen (emulator): ništa se ne pomera, a informacija je ista; Lottie na prvom kadru.

## D. Budžeti performansi i merenje

### D1. Poslednje izmereno (HONOR, 7.10. nije ponovljeno)

| Veličina | Pre (nezakrpano) | Posle (B22 zakrpa, 2 ciklusa, 207 s) | Izvor |
|---|---|---|---|
| Janky kadrovi | 1,93 % | **1,46 %** (59 od 4.041) | B22 §9.0 |
| p50 / p90 / p95 / p99 | – / – / – / 22 ms | 5 / 8 / 11 / 19 ms | B22 §9.0 |
| Kadrovi preko 700 ms; preko 97 ms | nije čuvano | 0; 0 (histogram) | B22 §9.0 |
| Linije loga aplikacije | 465.742 (1.925/s) | 1.100 (5,3/s) | B22 §9.0 |
| Reanimated upozorenja | većina od 465.742 | 33 (limit 500) | B22 §9.0 |
| ANR / pad | nema | nema | B22 §9.0 |

Interakcije (EX-03d, JS sat, HONOR): halo pina 85 / 91 ms (p50/p95), podaci kartice 71 / 78 ms, Back → vraćeno 162 / 218 ms; **vidljivi povratak po pikselima 1–2 s, nezatvoreno** (`EX03_DISCOVERY_POLISH_20260930.md`). Ograničenja: jedan telefon, jedna vožnja po ruci, 7 DEV zadataka, mlad proces; ture su samo čitanje; sonde animacija P1–P5 (B22 §9.5) nikad nisu pokrenute; bilo koji broj sa emulatora ostaje označen AVD.

### D2. Predloženi budžeti [P]: kapija = ne sme gore, cilj = kuda idemo

| Veličina | Kapija | Cilj | Napomena |
|---|---|---|---|
| Janky kadrovi, ista tura (`window5_tour.py` nepromenjen) | najviše 2,0 % i najviše +0,5 p.p. od sačuvane referentne vožnje | najviše 1,0 % | šum nije poznat: dve vožnje po stanju |
| p50 / p90 / p95 / p99 | 6 / 10 / 12 / 22 ms | 5 / 8 / 11 / 16 ms | 22 je stari B22 prag |
| Kadrovi preko 100 ms · preko 700 ms | 0 · 0 | 0 · 0 | 700 ms je "frozen" [S8] |
| Linije loga aplikacije · Reanimated upozorenja | najviše 10/s · najviše 500 | 5/s · najviše 50 | broji `b22/count_log.cjs` |
| Prst → prva vidljiva reakcija (dugme / kartica) | 100 ms [S19] | 1–2 kadra posle `PRESS_DELAY` | EX-03: halo 100 ms |
| Pin → kartica · topli povratak | 200 ms · 350 ms (EX-03) | – | povratak po pikselima još ne |
| Panel odozdo: prvi pomereni kadar · smirenje | 100 ms · 350 ms | – | smirenje računato, ne mereno |
| Prelaz napred: prvi pomereni kadar | 100 ms | – | N1 |
| Hladan start TTID · "Čeka te" ili stanje mirovanja vidljivo | **bez baze:** izmeriti 5 puta, pa postaviti | TTID najviše 2,5 s, sadržaj najviše 3,5 s | Android vitals "loše" od 5 s hladno [S10]; server `rpc_home_attention` 884 ms prvi put, 86 ms posle (`TALASI_REDOSLED_20261007.md`) |

### D3. Protokol merenja

1. **Uređaji i pravila.** Svakodnevno AVD, relativno (isti AVD, isto opterećenje domaćina, pre/posle). Apsolutne kapije samo na HONOR u prozoru "sad" (6 min): dodiri, prevlačenja, Back, čitanje; bez promene podešavanja i bez brisanja podataka; foreground provera pre svakog unosa (kao `b22/scripts/ui.py`). Serijski broj iz `scripts/qa_device.py`, nikad hardkodovan. DEV APK je `assembleRelease` (`.github/workflows/build-android-dev-apk.yml:206`) [K]; debug je 2,4–2,7× sporiji u merenju [S30], zato se meri samo CI-izgrađeni APK.
2. **Komande** (paket `rs.uskoci.dev`): `adb -s SER shell dumpsys gfxinfo rs.uskoci.dev reset`, scenarij, pa `dumpsys gfxinfo rs.uskoci.dev` (Total frames, Janky frames %, 50/90/95/99. percentil, Missed Vsync, Slow UI thread, Slow draw) i po potrebi `... framestats` (poslednjih 120 kadrova, ns) [S9]. Hladan start: `adb shell am start -S -W` daje `ThisTime/TotalTime`, TTFD preko `reportFullyDrawn` [S10] (na HONOR samo u prozoru). Frekvencija osvežavanja prvo (npr. `dumpsys display`), jer je budžet kadra 16,7 / 11,1 / 8,3 ms za 60 / 90 / 120 Hz [S8].
3. **Sonde po interakciji** (svaka: `gfxreset`, najmanje 10 ponavljanja sa razmakom 1 s, najmanje 300 kadrova, `gfx`, krajnje stanje, dve vožnje za šum): B22 P1–P5 (panel Zadaci, pilula Mapa, pritisak kartice, pin → kartica, remount) plus nove: S6 pretraga otvori/zatvori ×10, S7 automatski prelaz odeljaka ×10, S8 prelaz napred/nazad ×10 (6 parova iz B10), S9 sleganje liste na tri tačke ×10, S10 prevuci-za-pročitano ×5, S11 hladno učitavanje liste (skelet → redovi) ×5.
4. **Šta se NE meri na HONOR:** trajanje animacije od 240 ms (burst snimaka na 0,9 s je pregrub): samo krajnje stanje i broj kadrova. Video (`screenrecord`) i Perfetto FrameTimeline [S8] samo na AVD, kad treba uzrok.
5. **Matrica smanjenog pokreta (AVD):** `animator_duration_scale` i `transition_animation_scale` 1,0 (podrazumevano) i 0 (RN: reduce = Transition Animation Scale off [S27]); svih 25 ekrana iz B prolazi bez pomeranja; vratiti na 1,0. Pri 10× usporenju (Developer options [S11]) vizuelno proveriti redosled.
6. **Izveštaj:** JSON po sondi + tabela pre/posle u `docs/implementation/ui-ux-pass-20261002/`, nivo (AVD ili HONOR) i APK (`sha256`) uz svaki broj; veći koherentni paketi pre APK-a (AGENTS 3.2.3), ne APK za svaku sitnicu.

## E. Prioritizovana lista po talasima

Veličina: S do 1 dan, M 2–4 dana, L preko 4 dana. Timovi i vlasništvo fajlova prema `TALASI_REDOSLED_20261007.md` (jedan pisac po fajlu). "Odobrenje": šta traži vlasnika. Izmena tokena uvek ide uz `ui/system/__tests__/one-token-source.test.ts` (pinovi: `push: 280`, `springSheet`) i ratchet listu.

**Talas 0: merenje pre izmena (bez koda).** M-00 Referentne vožnje: `window5_tour.py` nepromenjen ×2 na AVD i ×1 na HONOR, sonde S6–S11 iz D3, snimiti 6 parova prelaza (B10) pre W1. QA/integracija. Odobrenje: prozor "sad".

**Talas 1: jedan zajednički APK, mali rizik, najveći osećaj.**

| ID | Šta | Fajlovi (tim) | Testovi | Odobrenje · veličina |
|---|---|---|---|---|
| M-01 | Prelaz napred: `easing` `easeOut` eksplicitno + 240 ms; proveriti smer na 6 parova | `app/(app)/_layout.tsx`, `ui/system/tokens.ts` (S) | proširiti `__tests__/tabLayoutSafeAreaContract.test.ts` (spec ima `easing` i `sys.motion.push`); pinovi `push: 240` u `one-token-source.test.ts` | nema · S |
| M-02 | Dolazak posle skeleta: `afterLoading` u 5 lista (Zadaci, Dogovori, Moji zadaci, Moje prijave, Obaveštenja); Početna skelet diše; `fade`/`arrive` upotrebiti ili obrisati | `home/HomePresentation.tsx` (H), `v2/DiscoveryPresentation.tsx` (T1), `v2/AgreementCollectionPresentation.tsx` (T3a), `v2/MarketplacePresentation.tsx` + `MyApplicationsPresentation.tsx` (T2a), `notifications/InboxPresentation.tsx` (T4a) | po ekranu: hladno posle skeleta ulaze najviše 6 redova jednom, toplo miruje, filter ne igra (proširiti `appear.test.tsx` i `*-presentation.test.tsx`) | nema · S |
| M-03 | Haptika: omotač `ui/system/haptics.ts` (grana `Platform.OS`, rezerva, guta greške, razmak 120 ms), `Press` ga zove; `error` na neuspehe; tik uspeha na prvom dostizanju; napredak: M-04 | `ui/Press.tsx`, novi `haptics.ts` (S); `ui/AgreementChat.tsx` (T3c) | novi `haptics.test.ts` (android: `performAndroidHapticsAsync` sa očekivanom konstantom; ios: `impactAsync`; bez funkcije: tišina); postojeći testovi ostaju jer `jest-expo` podrazumeva iOS | proba na HONOR u "sad"; D4 · S–M |
| M-04 | Mikrofon: `Gesture_Start` kad snimanje zaista počne, `Gesture_End` na slanje, `Reject` na otkazivanje; AI `VoiceMode` slušanje start/stop | `ui/media/AgreementVoiceControls.tsx` (T3c, posle T3a), `ui/aiFirst/VoiceComposer.tsx` | haptika se ne meša u `conversation-has-no-motion` (regex ne zna za haptiku) | nema · S |
| M-05 | `SuccessMark`: odluka D3; ako "bez preskoka" onda c ≈ 25; proveriti da `PublishedMoment` 1,5 s stvarno vidljiv | `ui/system/SuccessMark.tsx` (S) | `PublishedMoment.test.tsx`, ratchet unos `SuccessMark` | D3 · S |
| M-06 | Pilula "Mapa": RN `Animated` opacity umesto Reanimated `entering/exiting` | `v2/DiscoveryPresentation.tsx` (T1-map2) | `discovery-map-pills.test.tsx` | nema · S |
| M-07 | Jedan "pritisni i pusti": `usePressLift(sys.motion.scale.row)` u 4 kartice; `0.99/0.986` na lestvicu | `v2/TaskCard.tsx`, `OwnTaskCard.tsx`, `ApplicationFace.tsx` (T2a), `agreements/AgreementListCard.tsx` (T3a) | ratchet lista se smanjuje; `press-reduced-motion.test.tsx` | nema · S |
| M-07b | Mrtvi i dupli tokeni: `easeInOut`, `sheet`, `springSheet`, `tab`, `fade`, `loop`; literali 700 / 520 / 800 u komponentama | `ui/system/tokens.ts`, `Arrive.tsx`, `AiConversationShell.tsx` | `one-token-source.test.ts` | nema · S |

**Talas 2: struktura i doslednost.**

| ID | Šta | Fajlovi (tim) | Testovi | Odobrenje · veličina |
|---|---|---|---|---|
| M-08 | Pretraga bez JS visine: prvo izmeriti S6–S7; zatim ili Reanimated visina na UI niti, ili otkrivanje samo `transform/opacity` uz pomeranje odeljaka ispod (FLIP), ili ostaviti | `v2/discovery/Collapsible.tsx`, `SearchSheet.tsx`, `DiscoverySearchPanel.tsx` (T1-search) | postojeći paneli testovi + nova sonda; reduced: bez pomeranja | D5 (izuzetak od R1/R4) · M–L |
| M-09 | Traka koraka Dogovora: tačka 0,6 → 1 za 240 ms samo kad se stanje promeni dok gledaš | `agreements/AgreementSteps.tsx` (T3a) | prvo iscrtavanje bez pokreta, promena sa jednim; RM | nema · S |
| M-10 | Raspored: opciono dissolve 160 ms liste pri promeni nedelje ili dana; popunjavanje izabranog dana 180; tik pri koraku nedelje | `calendar/AgendaScreen.tsx`, `WeekStrip.tsx`, `weekSwipe.ts` (T3b) | `weekSwipe.test.ts`, `plannerScreen.test.tsx` | menja komentar "ništa što stoji vreme se ne pomera": kontejner da, brojke ne · S |
| M-11 | Prevuci Aktivni ↔ Istorija (O2) i Obriši (O5) sa praćenjem prsta: RNGH `PanGestureHandler` + `Animated.event` native driver drži R4; panel liste tik pri sleganju | `v2/AgreementCollectionPresentation.tsx` (T3a), `MarketplacePresentation.tsx` (T2a), `DiscoveryListSheet.tsx` (T1-map2) | novi testovi gesta (prag, `failOffsetY`, dugme radi isto) | nema · M |
| M-12 | Jedan prelaz napred: root `Stack` ↔ `(app)` `shift`; izbor porodice posle merenja iz M-00 | `app/_layout.tsx`, `app/(app)/_layout.tsx` (S) | spec test + 6 parova | D2 · M–L |
| M-13 | Onemogućeno = siva (jedan token), fokus polja u `field`, kontrast: zeleni tekst na neutralnom u `greenEdge`, ivica polja | `ui/system/tokens.ts`, `V2Action`, `PickerTile` i ostali vlasnici | kontrast test nad tokenima (par → minimum), `action-states.test.tsx` | ivica polja: odluka dizajna · M |
| M-14 | Doterivanje po C1–C8: razmak, ikone, radijusi, ivice kartica mape i liste | po timovima | skeniranje (literali) kao ratchet kao za tokene | nema · M |

**Talas 3: resursi i odluke vlasnika.**

| ID | Šta | Odobrenje | Napomena |
|---|---|---|---|
| M-15 | "Dogovoreno!" ceo ekran: `SuccessMark` 96 sada, Lottie lik kad stignu vlasnikovi crteži; niz: znak → reči → osoba, termin, iznos → dugme, oko 1,2 s, pa mir | Lottie fajlovi vlasnika; plaćeni resursi pojedinačno (R16) | `LottieArt` postoji i poštuje RM; nema poziva (UX plan 2.9) |
| M-16 | Ilustracije praznih stanja i likovi AI: `Arrive` ili Lottie | vlasnikovi V28 fajlovi još nisu stigli | samo likovi i trenuci, nikad dugme ili činjenica |
| M-17 | Eksperiment sa Reanimated fleg-om `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` ("preskače shadow tree commit za transform i opacity") | rebuild i prozor "sad"; ponovo B22 | [S30]: 11–19 % uštede; menja put koji zakrpa vidi (`NativeProxy.kt`) |
| M-18 | `Swipeable` → `ReanimatedSwipeable` | tek kad RNGH ukloni staru klasu | pazi R4: najviše 2 Reanimated pogleda po redu |
| M-19 | Razmotriti `react-native-ease` (3,4 ms prema 8,8 ms za 50 pogleda, ali samo deklarativni okidači) | **nova zavisnost: treba odobrenje vlasnika;** alternativa bez zavisnosti je RN `Animated` native driver | ne preporučuje se sada |
| M-20 | Pokret u Dogovor chatu (nov dolazak 160 ms) | D1: menja vlasnikovo pravilo i test | preporuka: ne; haptika (M-03/M-04) rešava osećaj |

**Ne preporučujem:** prelaze sa zajedničkim elementom (G2, B22); `LayoutAnimation` i Reanimated layout prelaze u listama (R4); shimmer gradijent (nova zavisnost, disanje je jeftinije); brojače koji se prebrojavaju (P5); paralaksu i animirani blur (Apple kriterijum [S5]); pulsirajući gradijent pozadine (Gemini [S40], bele površine); preskok na panelima i dijalozima.

## F. Izvori

**F.1 Stranice koje sam stvarno preuzeo** (WebFetch vraća sažetak male jezičke mašine; brojke koje su mi važne proveravao sam u drugom izvoru ili u instaliranom kodu kad je moglo). Pretrage (WebSearch) korišćene su samo da nađem adrese; ništa iz isečaka nije citirano kao činjenica.

- S1 `https://raw.githubusercontent.com/material-components/material-components-android/master/docs/theming/Motion.md` (i GitHub prikaz istog fajla): M3 trajanja 50–1000, standard easing, "trajanje raste sa površinom", container 300/250, shared axis i fade through 300, fade 150/75.
- S2 `https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/MotionTokens.kt`: kontrolne tačke krivih (standard, accelerate, decelerate, emphasized).
- S3 `https://developer.android.com/develop/ui/compose/animation/customize`: dampingRatio 1,0 / 0,75 / 0,5 / 0,2, opruga čuva brzinu pri prekidu.
- S4 `https://asciiwwdc.com/2018/sessions/803`: transkript Apple sesije "Designing Fluid Interfaces" (treća strana): odgovor odmah, prekidivost, 100 % prigušenje, preskok samo uz zamah, prst i sadržaj zajedno.
- S5 `https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria`: kriterijum smanjenog pokreta, animirani blur, zamena dissolve/highlight/boja.
- S6 `https://developer.android.com/develop/ui/views/haptics/haptics-principles`: "less is more", jačina prema važnosti, predefinisane konstante, sinhrono sa slikom, izbegavati jednokratne vibracije.
- S7 `https://docs.expo.dev/versions/latest/sdk/haptics/` i lokalno `node_modules/expo-haptics/build/Haptics.d.ts`, `Haptics.types.d.ts`: API, `performAndroidHapticsAsync`, Android simulacija preko `Vibrator`.
- S8 `https://developer.android.com/topic/performance/vitals/render`: budžet kadra 16 / 11 / 8 ms, sporo > 16 ms, zamrznuto > 700 ms, alati.
- S9 `https://webarchive.library.unt.edu/web/20160706090017mp_/https://developer.android.com/training/testing/performance.html`: arhivska kopija stare Android stranice (2016) za `dumpsys gfxinfo` (komande i polja; brojeve ne koristim).
- S10 `https://developer.android.com/topic/performance/vitals/launch-time`: hladan / topao / vruć start, TTID, TTFD, pragovi 5 / 2 / 1,5 s, `am start -W`.
- S11 `https://developer.android.com/studio/debug/dev-options`: skale animacija, Profile GPU rendering.
- S12 `https://support.google.com/accessibility/android/answer/7101858`: meta 48 dp, razmak 8 dp.
- S13 `https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html`, S14 `.../target-size-enhanced.html`, S15 `.../non-text-contrast.html`, S16 `.../contrast-minimum.html`, S17 `.../animation-from-interactions.html`: 24 / 44 CSS px, 3:1 za komponente, 4,5:1 / 3:1 za tekst, pokret iz interakcije.
- S18 `https://www.nngroup.com/articles/animation-duration/`: 100–500 ms, ulaz duži od izlaza (300 prema 200–250), ease-out za ulaz. S19 `https://www.nngroup.com/articles/response-times-3-important-limits/`: 0,1 / 1 / 10 s.
- S20 `https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/`: najviše 100 komponenti na slabom Androidu, layout svojstva skupa, fleg-ovi. S21 `.../layout-animations/entering-exiting-animations/`, S22 `.../layout-animations/layout-transitions/`, S23 `.../animations/withSpring/` (podrazumevane vrednosti, `duration` + `dampingRatio` isključuju fizičku), S24 `.../guides/accessibility/` (RM: ulaz stiže odmah, exiting i shared izostavljeni; `useReducedMotion` čita vrednost pri pokretanju).
- S25 `https://reactnative.dev/docs/animations`: native driver samo non-layout. S26 `https://reactnative.dev/docs/performance`: 16,67 ms, native stack u UI niti, JS nit i `Animated`. S27 `https://reactnative.dev/docs/accessibilityinfo`: Android reduce motion = Transition Animation Scale off.
- S28 `https://reactnavigation.org/docs/bottom-tab-navigator/`: `animation` none / fade / shift, `transitionSpec`, `sceneStyleInterpolator`. Uz to čitao sam instalirani `node_modules/expo-router/build/react-navigation/bottom-tabs/views/BottomTabView.js` i `TransitionConfigs/*.js`.
- S29 `https://gorhom.dev/react-native-bottom-sheet/props`: `animationConfigs`, `overrideReduceMotion`, `enableOverDrag`, `animateOnMount`.
- S30 `https://expo.dev/blog/the-real-cost-of-react-native-animations-benchmarking-every-approach` (i `.md`): Moto G8 Plus, RN 0.83, Reanimated 4.3.0, trošak po kadru za 10 / 50 / 100 / 500 pogleda, debug prema release, fleg-ovi (jedan sajt, jedan uređaj, `translateX` petlje).
- S31 `https://www.wix.engineering/post/moving-beyond-animations-to-user-interactions-at-60-fps-in-react-native`: zašto JS nit ne drži gestove na 60 fps (opšte).
- S32 `https://raw.githubusercontent.com/lottie-react-native/lottie-react-native/master/docs/api.md`: `renderMode`, `cacheComposition`, `progress`, `speed`.
- S33 `https://thumbprint.design/guidelines/motion/`: Thumbtack, trajanja 75–350 ms, krive, "quick but not jarring", stock animacije platforme.
- S34 `https://linear.app/now/how-we-redesigned-the-linear-ui`: poravnanje, gustina, kontrast (bez pokreta).
- S35 `https://news.airbnb.com/airbnb-2025-summer-release/`: samo izjava o "beautifully animated interface". S36 `https://www.richardrolfs.com/resources/airbnb-2025-lava-icons`: sekundarni izvor o Lava ikonama.
- S37 `https://lottiefiles.com/case-studies/wise`: vendor studija slučaja (dotLottie, zajednički šabloni). S38 `https://www.motiontheagency.com/blog/how-ui-animation-improves-user-experience`: agencijska analiza Revolut-a. S39 `https://9to5google.com/2026/04/19/gemini-live-app-redesign/`, S40 `https://mobilemasr.com/en/blogs/google-gemini-app-gets-a-full-makeover`: štampa o Gemini kompozitoru i Live režimu.
- S41 `https://design.google/library/expressive-material-design-google-research`: preuzeto, nema podataka o pokretu; ne koristim brojke.

**F.2 Pokušano, bez upotrebljivog sadržaja** (ništa iz njih se ne tvrdi): `m3.material.io` (samo naslov), `developer.apple.com/design/human-interface-guidelines/motion` i `.../playing-haptics` (samo naslov), `developer-mdn.apple.com` (HTTP 500), `base.uber.com` i stranica Motion (samo naslov), `medium.com/airbnb-engineering/introducing-lottie` (403), `www.androidauthority.com` (403), `www.androidcentral.com` (samo navigacija), `www.airbnb.com/building-a-visual-language` (404), `lottie.airbnb.tech` (samo naslov), `wise.design` (samo navigacija), `thumbprint.design` početna (samo navigacija), `www.taskrabbit.com/blog/?p=3973` (404), Compose `MotionScheme` (isteklo vreme), `superdesign.dev` (bez pokreta), `definingeverthing.wordpress.com` (samo upućuje dalje). Za Airtasker, TaskRabbit (pokret), Revolut i Uber nije pronađen nijedan prvostepeni dokument o pokretu.

**F.3 Lokalno, ne kao web izvor:** repozitorijum (K), `docs/implementation/product-v1-closure-20260926/finalization-20260927/` (B22, EX03), predlog 7.10. (`predlog_text.txt`), plan "Faza C - Pokret" iz `C:\Users\user\.claude\plans\refactored-sauteeing-cocoa.md` (iz 18.9.: `FadeInDown` 260 ms i izlaz 180 ms su kasnije zamenjeni tokenima 240/160 i R4), UX plan po ekranima 2.9, `TALASI_