# R4 — Naš identitet i potpis (kreativni pravac), 8. oktobar 2026

Autor: agent umetnički direktor (Sonnet 5.5, nasleđeno od roditelja). **Samo analiza i predlog**: nijedan izvorni fajl, server, DEV, uređaj ni zavisnost nisu dotaknuti; ovo je jedini novi fajl. Predlog za vlasnika i za sintezu i varijante u laboratoriji (vlasnik 8.10.: „biti KREATIVAN, ne generički“, `TALAS_RITMA_20261008_IZVESTAJ.md`); nije odobrenje.
Oznake: [K] pročitano u kodu (`USKOCI-CLEAN-spoj-20261006`, HEAD oko `1c1bc25f`, 8.10. 06:49, stablo čisto osim ovog fajla i R2/R3) · [S] viđeno na snimku laboratorije (web, FAKE podaci, 412 px, tekst se ne skalira; crvena traka „Received `false`…“ je artefakt React Native Web-a, ne ekran) · [D] dokument u repou · [P] moj predlog · [?] ne može bez telefona. Ništa nije proveravano na uređaju. Važe AGENTS 3.5–3.6 (bele površine, crn i siv tekst, jedna zelena radnja, narandžasta akcenat, tekst ≥ 12, „ti“ bez roda, „zadatak“, bez nove zavisnosti, ulaz V4.9 i HOME potpis zaključani).
Pročitano: `USKOCI_MASTER_PLAN_DIZAJNA.md`, `design-system/` (TOOLSET, ICON_SYSTEM, OWNER_*, R14/R15, diagnosis 25.9., izveštaj 24.9.), `DESIGN_SKILLS.md`, `OWNER_DESIGN_DIRECTION`, `UX_NACRT`, `ui-ux-pass-20261002/` (BRAND_MAP, MATERIAL, VISUAL_FINISHING, MOTION_I_POLISH, KOMPOZICIJA_I_RITAM, POTREBE_KORISNIKA, TEKSTOVI_REVIZIJA, UX_PLAN_PO_EKRANIMA, TALASI, TALAS_RITMA), sinteza 8.9. i Design Master 29.9., kod `src/ui/system/*`, `entry`, `home`, `objava`, `aiFirst`, svih 19 slika u `assets/illustrations` (kontakt-list), oko 40 snimaka laboratorije (f1–f6, f8a; snimljeni na međustanjima večeras, pre poslednje integracije od 06:32). Paralelni dokumenti istog kruga (R2, R3, `AIRBNB_OSECAJ_SPEC`) pregledani samo u zaglavljima; preklapanja su u odeljku J.

**Sažetak.** Red je rešen (grid 8.10.), ličnost nije: ekrani su uredni i bez lica. Predlog: **osam potpisnih elemenata** (S1 Predmet, S2 Uskok, S3 Žig, S4 Dah, S5 Svetlo, S6 Komšijski glas, S7 Par, S8 Pozornica), **pet trenutaka** (Objavljeno, Dogovoreno!, Prvi susret, Prva ocena, Stiglo je obaveštenje) i **deset predmeta koji fale** (O1–O10). Pravilo: potpis *zamenjuje* generičko (sivi disk → predmet, kugla sa kvačicom → žig, slova u krugu → lice) i nikad ne dodaje element; vlasnik je 7.10. rekao „izdeljeno, isprekidano“.
**Pravac u pet rečenica.** (1) *Svet:* USKOČI je radni sto komšije, krem papir, smaragdni emajl, narandžasta olovka, platnena torba; predmeti, ne ikonice. (2) *Ljudi:* lica, ne diskovi sa slovima; u Dogovoru uvek vidiš vas dvoje. (3) *Pokret:* sve „uskoči“ iz blizine za 240 ms i sleže; jedan težak trenutak, žig „Dogovoreno!“. (4) *Glas:* kratko, u „ti“, sa pravim imenom i pravim brojem; jedan uzvičnik. (5) *Svetlo:* beo ekran i meko svetlo gore-levo; toplina je u predmetima, licima i reči, ne u bojenju površina.

## 0. Šta je ranije odlučeno (sinteza i Design Master)

- **Sinteza 8–9.9.** (`docs/authority/sources/design/USKOCI_MASTER_DESIGN_SYNTHESIS_20260908.md`): ništa nije *odlučeno*; zaglavlje kaže „predlog, čeka izbor vlasnika“, a `AUTHORITY_INDEX.md` r. 32 je vodi kao SUPPORTING („ne vraćati 4500 ms/ODZIV/Onest kao odobreno“). Predloženi su North Star **ODZIV** („Meni treba.“ / „Ja mogu.“, Dogovor = obe replike na jednoj stranici), pravac **OD RUKE** (kost #FAF3E8, mastilo #0E3D37, narandžasti potez, Onest) i 5 trenutaka.
- **Posle toga odlučeno, i to briše OD RUKE:** V28 paleta i Inter (22.9.), bele površine i crn tekst (25.9., 2.10.), zelena glavna radnja, 2.5D predmeti (2.10.), reljefni znak 13524 (3.10.).
- **Preživljava (uzimam):** dve strane koje se susreću u Dogovoru (bez boje-po-ulozi); status = oblik + reč (već `StatusChip`); „sleti“ kao jedini autorski pokret za kontakt (→ S3); „Dogovoreno“ kao naslov posle potvrde, nikad dugme; komponenta „Iskaz“ = naš `FactRow` + `Surface record`.
- **Design Master 29.9.** (`DESIGN_MASTER/USKOCI_DESIGN_MASTER_20260929.html`, v0.4), DIRECTION LOCK koji poštujem: scena samo gde je istina potvrđena (Dogovor, završetak, ocena); „NONE“ za mapu, filtere, poređenje, privatnost, bezbednost i destruktivne radnje; jedna porodica asistenta u dva režima; ljudi „kao ljudi“ (Community Cast 4–6, još bez koda); pokret „ima razlog i kraj“ (greet 0,45–0,75 s, think 0,8–1,4, confirm 0,25–0,45, success 0,55–0,9); ugovor `MomentScene` (ekran odlučuje kad je trenutak legalan). Njegove boje su starije od `sys` tokena; važe tokeni.

## 1. Gde je svaki ekran generički

Test: **zaklopi logotip; ako ne znaš čija je aplikacija, ekran je generički.** Pet nalaza:
1. **Red je rešen, ličnost nije** [S]: ivica 20, ritam i `Surface` drže, ali Početna, Zadaci i Dogovori izdrže zamenu logotipa.
2. **Ljudi su sivi diskovi sa slovima** (`Avatar`: `greenSoft` krug, zelena slova) na Profilu, kandidatima, Dogovorima i Porukama, a proizvod je o ljudima. Slova `green` na `greenSoft` imaju 4,25:1 [D: MOTION C3].
3. **Trenuci su ploča i ravna kvačica**: „Prijava je poslata.“ i „Ocena je sačuvana.“ = siv krug + kvačica; „Zadatak je objavljen.“ = kugla sa kvačicom u sivom krugu [S f3, f5, f4; K `PublishedMoment`].
4. **Dogovor, srce proizvoda, je obrazac**: tabela „Uslovi“ + četiri iste zelene kvačice; ni predmeta ni lica para; „Dogovoreno!“ ne postoji nigde u kodu [K grep].
5. **Naši predmeti su ostrva**: znak 112 dp gore levo, dve pločice sa predmetom 64 dp, nalepnice 28 dp u redovima, između njih prazan beo ekran. Pet predmeta je plavo po ulozi (`artRole`: lokacija i komunikacija), a `people-v2` je plavo-siv iako `artRole.people` kaže koral, a logotip zeleno + narandžasto.

| Snimci · ekrani | Gde je generički | Šta je već naše |
|---|---|---|
| f1 Početna | [S] dve sive pločice (`wash` #F7F7F7) sa predmetom 64 dp liče na dugmad podešavanja; „Čeka te“ = pet nepovezanih predmeta (plavi par, lanac, kalendar, tabla, zvezda) + narandžaste tačke; „Raspored“ = obična kartica sa velikim vremenom; nema lica ni komšiluka | dimenzionalni znak, predmeti, „ti“ („Opiši šta ti treba.“) |
| f1 Obaveštenja, Poruke, Podešavanja | naslovi su vrste („Nova prijava / Imaš novu prijavu za zadatak.“), bez imena i naziva; Poruke = inicijali u diskovima + crn brojač „3“ (tabela boja: ono što čeka je narandžasto); Podešavanja = platformski prekidači i beli redovi | predmet + tačka po vrsti, dani u grupama |
| f2 Zadaci (lista, detalj, pretraga, prazno) | kartica = naslov, iznos, tri ravna zelena znaka, inicijali, ocena: ista kao u bilo kom oglasniku, iznos jednak naslovu; detalj = crn naslov + tri znaka, jedino zeleno „Sastavi prijavu →“; pretraga = lista zelenih pinova; prazno = predmet u sivoj ploči (pre F8b; snimci su stariji od vraćanja 2.5D na `FactRow`, ART 28 [K]) | cena kao glavni broj, „po vremenu u Srbiji“, mapa |
| f3 Moji zadaci, Prijave, Kandidati, Forma | sve su iste bele kartice istog kroja; kandidat = slova + zvezdica + iznos; izbor prijave = obična potvrda; forma = standardna polja; „Prijava je poslata.“ = siva ploča + kvačica | čipovi stanja (oblik + reč), „Ima: Kombi · Trake“ |
| f4 Objava (dodatno) | robot je mali (88 dp) i sam; razgovor = tamni balončići + robot 24 dp; „Nacrt“ = okvir sa sivom tačkom; „Zadatak je objavljen.“ = ploča + kugla + dugme | asistent, „Na primer“ sa tri rečenice |
| f5 Dogovori, Dogovor, Raspored, razgovor, ocena | lista = kartica sa čipom i iznosom; pregled = „Uslovi“ + 4 iste kvačice + krem napomena; razgovor = standardni balončići; ocena = 5 ravnih narandžastih zvezda + sivi disk sa kvačicom | „sada → novo“, narandžasta „noga“ za ono što čeka |
| f6 Profil, Radni profil, Podrška, O aplikaciji, Javni profil | avatar = slova u sivom krugu 72/96; „Moja statistika“ = tabela brojeva; javni profil = redovi sa ravnim znacima; Inter piše „AI“ kao „Al“ (I = l) | **O aplikaciji je jedini ekran koji izgleda kao USKOČI** (veliki 3D znak + „Pomoć počinje dogovorom.“) |
| f8a primitivi (galerija) | tehnički indeks (sedam istih zelenih „i“ nalepnica); nije proizvod | grid i primitivi |

## A. Šta je USKOČI

**Rečenica [P]:** „USKOČI je komšiluk koji dogovara pomoć: ti kažeš šta ti treba, neko iz blizine uskoči, i obe strane znaju na čemu su.“ U skladu sa postojećim „Pomoć počinje dogovorom.“ (O aplikaciji) i zaključanim „Tvoj partner za svaki zadatak.“ (ulaz).
**Osećaj: „Važi.“** Olakšanje kad je neko rekao *ja ću*, a ti znaš kada, gde i za koliko. Ne uzbuđenje: mirno „stvar je rešena“. Vrhunac je trenutak „Dogovoreno!“; sve ostalo je put do njega ili posle njega.
**Metafore.** *Uskoči* = ulazak u kadar: jedan element dolazi iz blizine i staje na mesto (→ S2). *Dogovor* = dvoje se susretnu, stisnu ruku i to se overi (→ S7, S3); isto kaže logotip: dvoje čine „U“, stisak je na dnu, pin i osmeh unutra. Proizvod u četiri takta, svaki sa svojim potpisom: **Reci** (asistent, papir + pin + olovka) → **Uskoči** (predmet, Uskok, Dah) → **Dogovori** (Par, Žig) → **Oceni** (Zvezda, Svetlo).

| Doživljaj | Kako ga ekran daje | Šta ga kvari |
|---|---|---|
| Lakoća | jedan predmet, jedna odluka, jedan zeleni glagol, dosta belog | četiri jednako glasne stvari, ploče u pločama |
| Pouzdanost | tačne činjenice, „Ne znamo da li je uspelo“ + „Proveri“, nikad izmišljen broj | obećanja koja telefon ne ispunjava („Javićemo ti“ bez pusha) |
| Toplina | krem, smaragd i narandžasti predmeti, lica, „ti“ i stvarna imena | sivi diskovi, tehnički jezik |
| Brzina | prva reakcija ≤ 100 ms, ulaz 240 ms, ništa ne čeka dekoraciju | spori prelazi, pokret na činjenicama |

**Tri pravila potpisa:** (1) zamenjuje, ne dodaje; (2) jedan predmet i jedan glagol po ekranu; (3) toplina je u predmetima, licima i glasu, ne u površinama (bele ostaju bele).
**Prijemni test za varijante u laboratoriji:** zaklopi logo, prepoznaje li se po predmetu, pokretu ili glasu · svaki ekran nosi S5 i S6 (uvek) i najmanje jedan, najviše dva od ostalih; tihi ekrani (forme, podešavanja, čet) smeju samo S5 + S6 · 361 dp, font 1,15 i reduced motion.
**Zamerke vlasnika (2.10. i 7.10.) → odgovor** [D: `OWNER_START_AND_COMPLAINTS`, `OWNER_PHONE_FAILURE`]: „generički izgled“ → S1–S8 · „loš pokret“ → odeljak E (pet pokreta, jedan težak trenutak) · „loše ikonice“ i „previše ujednačeno, zeleno i zbijeno, slabe male ilustracije“ → S1 (predmet velik gde osoba stiže, mali gde se čita; `Glyph` samo za komande), S8 · „preglednost“ i „nejasni ekrani“ → S5, S8, odeljak C · „izdeljeno, isprekidano“ → pravilo „zamenjuje, ne dodaje“.
**Odakle ideje, bez kopiranja** [D: MOTION A1, KOMPOZICIJA §5]: Airbnb 2025, 3D animirane ikone → naši predmeti tabletop sveta, animirani samo u trenucima · Gojek, porodica 3D predmeta → jedno svetlo, jedan materijal, pravilo „jedan predmet“ · Wolt, ton sa karakterom → komšijski „ti“ sa stvarnim detaljem · Apple, kontinuitet i prekidivost → Dodir i Uskok · Revolut, „jedna stvar pažnje odjednom“ → koreografija trenutaka · TaskRabbit i Airtasker, poverenje kroz lice i ocenu → Par.

## B. Osam potpisnih elemenata

**Na svakom ekranu** su S5 Svetlo, S6 Glas, S2 Uskok (kad nešto stigne) i jedan predmet (S1 ili S8); **situacioni** su S3 Žig, S4 Dah i S7 Par. Svaki element ima jedan nosilac u kodu i nijedan ne dira ulaz V4.9 ni HOME potpis. Redosled po vrednosti i ceni: S2 → S8 → S6 → S1 (postojeći predmeti) → S3 → S7 → S4 → S5. Cena: S do 1 dan, M 2–4 dana, L preko 4 (kao u `MOTION_I_POLISH` E). Sve je RN `Animated` (native driver), Reanimated, `expo-image`, `react-native-svg`, `expo-haptics`; nova zavisnost nije potrebna.

### S1 · Predmet (nalepnica), jedinica značenja
- **Opis.** Svako značenje je jedan mali tabletop predmet (3D, svetlo gore-levo, krem + smaragd + narandžasta, providna pozadina), nikad ikonica u krugu. Predmet kaže *šta je* (zadatak, mesto, termin, cena, prijava, Dogovor), tekst pored njega kaže *koliko i koje*. Nalepnica ≤ 32 dp, predmet 48–96, scenografija ≥ 96 (S8).
- **Mere.** Lestvica 24 (ravni znak, `factCutFor` ≤ 24) · 28 (`FactRow`) · 32/40 (slot reda, `layout.slot` 40) · 48 · 64 (vrata, `DOOR_ART`) · 96 (stanja, `StateView` ART) · 120–160 (trenuci, novo). Najviše jedan predmet ≥ 48 dp po ekranu (Početna: dva, 2 × 64). Bez teksta, cifre i kvačice (kvačicu smeju samo `check`, `agreements`, `shield`); nikad se ne boji stanjem (tiho = siva vektorska varijanta `tone="quiet"`); nikad nije kontrola (kontrole su `Glyph`). Isporuka: 640² za ≥ 96 dp, 384² za 48–64, 256² za ≤ 40; PNG/WebP sa alfom ≤ 150 KB (najveći prikaz 160 dp × 3,5 = 560 px; danas 19 PNG po 0,9–2,1 MB, oko 1254²).
- **Gde.** Početna, kartice i redovi, prazna i prva stanja, trenuci, Profil, obaveštenja (32), pitanja za dozvole.
- **Nosi.** `system/FactArt.tsx` (30 vrsta, 2 reza), `materialSubjects.ts` (17 sirovih predmeta), `HomeLaunchArt`, `ConversationArt`, `PeopleArt`, `MoneyArt`, `CalendarArt`, `ClockArt`, `ToolArt`, `CatalogArt`, `assets/illustrations/` (19 PNG), `assets/ai/uskoci-assistant.png`.
- **Fali.** O1–O10 iz odeljka F (Par umesto plavo-sivog `people-v2`, zvezda, tri sloja zadatka, papirni avion, stisak ruku, lupa, utikač, šoljica, poze asistenta, pečat-alat).
- **Cena / rizik.** Umetnost S–M po komadu (ugrađeni generator kao 2–3.10.; plaćen izvor = pojedinačna odluka, R16); kod ≤ 0,5 d. Rizik: pet plavih predmeta (`pin-v1`, `messages-v2`, `support-v1`, `remote-v1`, `people-v2`; plavo je uloga lokacije i komunikacije u `artRole`) i `money-v3` koji se čita kao dolar, a iznos je u RSD; težina APK-a (19 × ~1,3 MB); nečitljiv detalj na 24 dp (tu ostaje ravni znak).

### S2 · Uskok, pokret ulaska
- **Opis.** Stvar *uskoči u kadar* iz 8 dp ispod i sleže; ništa ne klizi preko ekrana, ništa ne preskače. Dva oblika: red (`Appear`) i predmet (`Arrive`: uzlet, mali nagib, mir). Jedna poruka: „nešto novo je stiglo“, pa se igra samo za novo (novi id, prvo učitavanje, prazno stanje, trenutak), nikad za ono što je već tu.
- **Mere.** Red: `sys.motion.enter` 240 ms, `easeOut` [0,23; 1; 0,32; 1], pomak `sys.space.sm` 8 dp, razmak `stagger` 40 ms, najviše 6. Predmet: `sys.motion.arrive` 800 ms [0,22; 0,8; 0,25; 1], uzlet 4 → −3 → 0 dp, nagib −3° → 1° → 0°, providnost 0,65 → 1, odlaganje 80 ms, jednom po montiranju. Asistent: samo providnost 240 ms (postoji). Izlaz `exit` 160 ms. Reduced motion: odmah gotovo.
- **Gde.** Novi redovi; skelet → lista jednom; prazno i greška (predmet); trenuci M1–M5; Početna prvi put (vrata, `Arrive` sa odlaganjem 80 i 200 ms).
- **Nosi.** `system/Appear.tsx`, `Arrive.tsx`, `aiFirst/AiAssistantArt.tsx`; `useAppear({afterLoading})` danas prosleđuju Početna, Dogovori i Zadaci [K grep].
- **Fali.** Nema umetnosti. Kod: `afterLoading` u Moji zadaci, Moje prijave i Obaveštenja, `Arrive` van `StateView`, ime „Uskok“ u `DESIGN_SKILLS.md`.
- **Cena / rizik.** S. Nizak rizik: B22 (RN Animated, ≤ 2 Reanimated pogleda po redu, 6 redova); nikad na činjenicama (iznos, vreme, broj, reč stanja ulaze gotovi, `tokens.ts` 201–206).

### S3 · Žig „Dogovoreno!“
- **Opis.** Jedini „težak“ predmet. Zaključani znak U (dvoje + stisak + pin) u zelenom prstenu: pečat dogovora. Pada na ekran kad je Dogovor *potvrđen na serveru* (M2) i ostaje kao prvi čvor koraka u pregledu Dogovora. `BrandMark` se koristi kakav jeste: ne crta se ponovo i ne animira po delovima (intro ostaje zaključan).
- **Mere.** Prsten Ø 112 dp, linija 3 dp `sys.color.green`; unutra `BrandMark` 72 (≥ 48 dp = sirovi atlas), razmak 8; kontaktna senka elipsa 84 × 10, `rgba(0,0,0,.10)`. Mali: Ø 32 u čvoru koraka (24 → 32, veza se centrira), prsten 2 dp, `BrandMark` 24 (vektorska `small` varijanta). Pokret: skala 1,12 → 1 za 180 ms `easeOut` + providnost 0 → 1 za 120 ms; na kontaktu `tick('success')`; odjek: prsten skala 1 → 1,35, providnost 0,35 → 0, 320 ms; jedan prolaz.
- **Gde.** M2 (ceo ekran posle izbora prijave; kod druge strane jednom pri prvom otvaranju novog Dogovora), prvi čvor `AgreementSteps`, traka „Poruka“ „Dogovor je sklopljen“ (znak 24 dp).
- **Nosi.** `entry/BrandAssets.tsx` (`BrandMark`), `system/SuccessMark.tsx` (zamenjuje se), `v2/ApplicationSelectionPresentation.tsx:379`, `agreements/AgreementSteps.tsx`, `system/haptics.ts`.
- **Fali.** Komponenta `DogovorSeal` (prsten + znak + senka). Umetnost: ništa obavezno; opciono O10 (žig-alat) za varijantu „udarac“.
- **Cena / rizik.** M (~2 d: komponenta, 2 mesta, testovi). Rizik: skala > 1 na SVG atlasu može da omekša 180 ms (ako se vidi: `translateY` −16 → 0); dvostruki dodir preskače trenutak (dugme sredinom ekrana, kao u `PublishedMoment`); „pečat“ je birokratski ton, odlučuje vlasnik (D4); nikad pre servera (Master: uspeh tek posle potvrde).

### S4 · Dah (tačka koja diše)
- **Opis.** Zelena tačka koja *diše* znači „ovo je sada živo“; narandžasta koja stoji znači „čeka tebe“. Samo za stvarna stanja: „Slobodan sam sada“ je uključen i važi, termin Dogovora je u toku („U toku“), asistent sluša (sjaj po nivou glasa već postoji).
- **Mere.** Tačka Ø 10 dp `sys.color.green`, bela ivica 2 dp; oreol skala 1 → 1,8 i providnost 0,35 → 0 za 1600 ms (`loop.glow`), pauza 1600 ms; samo `transform` i `opacity`. Na dugmetu profila: pomak −2/−2 od kruga 44 dp. Narandžasta tačka (Ø 8) ne diše.
- **Gde.** Dugme profila u korenskoj traci (dok je „Slobodan sam sada“), čip „U toku“ u pregledu Dogovora, red „Slobodan sam sada“ na Početnoj.
- **Nosi.** `system/ScreenChrome.tsx`, `StatusChip.tsx` (`task.now`), `home/HomePresentation.tsx:200`; nova `LiveDot`. Korak „trenutni“ u `AgreementSteps` ostaje bez petlje (M-09).
- **Fali.** Umetnost: ništa. Podatak: istek „Slobodan sam sada“ (R06, `available_now_expires_at`) da tačka ne laže.
- **Cena / rizik.** S. Rizik: R4 (≤ 4 petlje, samo fokusiran ekran, staje u pozadini i pri reduced motion → statična tačka bez oreola), baterija na korenu (jedna petlja), nikad na redu liste.

### S5 · Svetlo (topla ivica i senka)
- **Opis.** Jedan izvor svetla (gore-levo) za predmete i za površine: kartica „stoji“ na istom stolu kao predmeti. Toplina je u *mekoći*, ne u nijansi; bela ostaje #FFFFFF, senke ostaju neutralne (AGENTS 3.6.5).
- **Mere.** Nivoi: 0 ekran (bez senke) · 1 zapis `raisedItem` (ivica `line` #EBEBEB, ugao 24, 16 unutra, `0 2 3 .055 + 0 5 12 .07`) · 2 plutajuće `floating` (`0 5 18 .063 + 0 1 2 .027`) · 3 panel `sheetLift` (ugao 28, rukohvat 36 × 4) · 4 dijalog (ugao 24, `dim`). Kontrole: uzdignuto `materialControl.raised` → utisnuto `inset`. Predlog: svim senkama horizontalni pomak **+1 dp** (neutralne, alfa ≤ 0,14); kontaktna senka predmeta pada dole-desno; ≤ 1 narandžasta iskra po ekranu.
- **Gde.** Svi zapisi, plutajuće (pretraga, composer), paneli, vrata Početne, čipovi.
- **Nosi.** `system/tokens.ts` (`raisedItem`, `floating`, `materialControl`, `sheetLift`), `Surface.tsx`.
- **Fali.** X-pomak u tokenima; pravilo „kontaktna senka predmeta“ u uputstvu za umetnost.
- **Cena / rizik.** S (token + 6 snapshot-a + ratchet). Rizik: jedva vidljivo, vrednost je doslednost; obojene senke i tintirane površine su odbijene (R12), ne uvoditi.

### S6 · Komšijski glas
- **Opis.** Reči kratke, direktne, tople, u „ti“; lični detalj *samo ako je stvaran* (ime, naziv zadatka, termin, iznos). Glagol „uskoči“ je rezervisan za obećanje proizvoda i radnju osobe koja pomaže. Jedan uzvičnik u celoj aplikaciji: „Dogovoreno!“.
- **Mere.** Rečenica ≤ 12 reči, naslov ≤ 4, dugme = glagol + predmet (≤ 3 reči); naslov trenutka završava tačkom, naziv ekrana nema tačku; navodnici „…“; vreme „5. okt · 12:00“ + „po vremenu u Srbiji“; množina kroz `plural()`; emotikoni samo u odgovorima asistenta (vlasnik 22.9.). Primeri: odeljak G.
- **Gde.** Svi ekrani, najviše stanja, trenuci, obaveštenja, dugmad.
- **Nosi.** `system/outcomeCopy.ts`, pozivi `StateView`, `notifications/inboxCopy.ts` i `publicInboxCopy.ts`, `data/ownTaskStanding.ts`; server `private.notification_copy_v5` i Edge `pushNotificationCopy.mjs` (traže „PRIMENI“); `TEKSTOVI_PREDLOZI_20261007.json` (637).
- **Fali.** Naziv zadatka u obaveštenju (R11, `taskTitle` u `rpc_list_inbox`), ime druge osobe u rečenici.
- **Cena / rizik.** S–M. Rizik: deklinacija imena (pisati „Marko: …“, ne „Markova prijava“), rod u prošlom vremenu, push bez teksta zadatka na zaključanom ekranu (A20).

### S7 · Par (lice i dvoje)
- **Opis.** Brend je dvoje koji se spoje. U proizvodu to je **lice + lice**: u Dogovoru uvek vidiš *vas dvoje*. Lica nisu sivi diskovi: fotografija ili slova na toplom krugu, a glavna osoba ima „nalepnica“ ivicu (bela ivica + senka). Prsten oko lica nosi stanje.
- **Mere.** Lica 32/40/48/56/72/96 (`Avatar`); od 56 dp bela ivica 2 dp + `0 1 3 rgba(0,0,0,.16)`; par: dva lica 56 dp preklopljena 12 dp (kompaktno 40/10 u traci), a u M2 lica *flankiraju* žig (razmak 12), ispod „Ti“ i ime (`note` 14/20), uloga `meta` 13; prsten 2 dp: `green` kad je Dogovor potvrđen, `lineStrong` pre, bez prstena kad je završen. Slova na krugu: `greenEdge` #226B52 (5,75:1) umesto `green` (4,25:1).
- **Gde.** Traka pregleda Dogovora, M2, potvrda izbora, Kandidati (56), Profil (96), javni profil (72), Poruke (56), Raspored i Početna (40).
- **Nosi.** `system/Avatar.tsx`, `system/ActualUserAvatar.tsx`, `media/ContextPhotos.tsx` (`ProfilePhoto`), `agreements/AgreementWorkspace.tsx`, `system/DetailTopBar.tsx`.
- **Fali.** Komponenta `PairFaces`; umetnost O1 „Par“ (3D, zamena za `people-v2`) za prazna stanja i „Kako radi“.
- **Cena / rizik.** M. Rizik: čitanje fotografija po redu (par samo na detalju, ne u listi), tuđa fotografija samo gde je već vidljiva, tri komponente za jedno lice (`Avatar`, `ProfilePhoto`, `ActualUserAvatar`) pa prvo objediniti.

### S8 · Pozornica (mrtva priroda)
- **Opis.** Prazna, prva i greška stanja su mala mirna *mrtva priroda*: 1–3 srodna predmeta, pod istim svetlom, bez kartice, jedna rečenica i jedna zelena radnja. Prazno nije tuga: predmet sleže jednom i miruje („bez beskonačne tuge“, Master).
- **Mere.** Predmet 96 dp (stanje) ili 120–160 (prvi susret); sredina bloka na ≈ 38 % visine (`StateView` `above` 1 : `below` 4); stub najviše 280 dp (`MEASURE`); naslov `title` 21/26, rečenica `copy` 15/22 `muted`; ≤ 1 zelena + ≤ 1 tiha radnja (razmak 8); `Arrive` 800 ms jednom. Greška i „nema veze“: predmet *topao* (O8), ne sivi znak, bez `Arrive`.
- **Gde.** Sva prazna stanja (Moji zadaci, Prijave, Dogovori, Poruke, Obaveštenja, Raspored, Zadaci, pretraga, fotografije, podrška), „Kako radi“, greške, AI početak.
- **Nosi.** `system/StateView.tsx`, `Arrive.tsx`, `StateGallery.tsx`, `materialSubjects.ts`.
- **Fali.** Predmeti za pretragu bez rezultata (O7), „nema veze“ (O8), „čekaš“ (O9), prvi dan (O5).
- **Cena / rizik.** S + umetnost. Rizik: previše „slatko“ u ozbiljnim stanjima (privatnost, bezbednost, brisanje ostaju `CatalogArt` 32 + tekst, Master „NONE“).

## C. Tipografski glas

Inter ostaje (4.001; spakovani 400/500/600/700 + 800; 800 koristi samo zaključani ulaz, trenutak ostaje na 700). Glas je **tih, uspravan i tačan**: težina nosi odluku, razmak nosi dah, broj nosi poverenje.

| Uloga | Token | Veličina / težina / praćenje | Boja | Primer |
|---|---|---|---|---|
| Naziv ekrana (traka) | `title` | 21/26 · 600 · −0,55 | ink #202020 | „Moji zadaci“ (bez tačke) |
| Ime stvari | `pageTitle` | 28/33 · 600 · −0,8 · balans redova | ink | „Unos ormara na treći sprat“ |
| Rečenica trenutka | `display` (+ varijanta `moment` 700, nov token) | 32/37 · 700 · −1,15; jedna po ekranu | ink | „Dogovoreno!“ |
| Naslov odeljka, kartice | `heading` | 18/24 · 600 · −0,3 | ink | „Uslovi“ |
| Rečenica pod naslovom | `copy` | 15/22 · 400 | `muted` #525252 | „Čim neko uskoči, videćeš ga ovde.“ |
| Činjenica | `note` / `body` | 14/20 · 500 / 16/24 · 400 | `fact` #404040 / ink | „Liman, Novi Sad“ |
| Broj (iznos) | `priceLarge` / `priceRow` | 24/30 · 700 · −0,7 · tabular / 16/21 · 700 | ink | „5.500 RSD“ |
| Mikrotekst | `meta` | 13/18 · 500 | `muted` | „po vremenu u Srbiji“ |
| Oznaka | `label` | 12/16 · 600 · praćenje 0 u čipu | ink / `waitingInk` | „Dogovoren“ |
| Radnja | `action` | 16/22 · 600 · −0,1 | `onGreen` na zelenom | „Uskoči na zadatak“ |

- Kontrast težina 400 ↔ 600, ne 600 ↔ 700; negativno praćenje raste sa veličinom (−0,3 na 18 do −1,15 na 32). Najviše 5 stilova po ekranu (KOMPOZICIJA D).
- Iznos je uvek **broj 700 tabular + „RSD“ u `meta` `muted`**; poznat iznos nikad ne menja mesto; nepoznat je reč („Prima ponude“), nikad „0 RSD“. Hiljade tačkom, vreme „24. okt · 10:00–12:00“ + „po vremenu u Srbiji“.
- Rečenični naslovi trenutka završavaju tačkom („Zadatak je objavljen.“), nazivi ekrana ne; **jedan uzvičnik u aplikaciji**: „Dogovoreno!“.
- **Razmaci teksta** (lestvica 4/8/12/16/24/32/48, KOMPOZICIJA A): naslov → rečenica pod njim 8; naslov odeljka → sadržaj 12; red u bloku 4–8; broj ↔ jedinica 4 na istoj osnovnoj liniji; odeljak ↔ odeljak 24; zona ↔ zona 32; naslov trenutka ↔ prva činjenica 16.
- Balans redova (`BALANCED_LINES`) u naslovima i centriranim rečenicama, bez usamljene reči.
- Inter piše I i l istim štapom: „AI“ se čita „Al“ [S o_aplikaciji]. U tekstu pisati „asistent“ (`TEKSTOVI_REVIZIJA` §4; pitanje 2 vlasniku je još otvoreno), „AI“ samo kao kratku oznaku.
- Kurziv: slogan ulaza je kurziv 700 (zaključano); u aplikaciji kurziva nema i ne uvoditi ga (nema Inter Italic datoteka; novi asset = odluka vlasnika).

## D. Jezik površina i dubine

| Nivo | Šta je | Mere (tokeni) | Primer |
|---|---|---|---|
| 0 Ekran | belo platno, bez senke | `ground` #FFFFFF, ivica `layout.gutter` 20 | Početna, detalj |
| 1 Odeljak, red | bez kontejnera; red = inset linija 1 dp `line` | `Section` razmak 24, `ListRow` slot 40, tekst počinje na jednoj ivici | Profil, Obaveštenja |
| 2 Zapis | dodirljivo | `Surface record`: bela, ugao 24, 16 unutra, ivica `line`, `raisedItem`; dodir 0,985 | zadatak, Dogovor, prijava |
| 2b Pločica | velika radnja sa predmetom | `wash` #F7F7F7, `materialControl.raised`, ugao 24, 16 unutra, visina ≥ 88 (predmet 64 + 2 × 12), dodir 0,985 | „Objavi zadatak“, „Uskoči i zaradi“ |
| 3 Okvir | samo se čita | `Surface panel`: ivica 1 dp `cardLine` #DEDEDE, bez senke | nacrt AI |
| 4 Plutajuće | leži preko nečeg | `floating` + ivica `line`; pilula `radius.pill` | pretraga, composer |
| 5 Panel | iznad ekrana | ugao 28, rukohvat 36 × 4, `sheetLift`, `sheetSpring` k300 c30 bez preskoka, zatvaranje 170 ms | filteri, potvrda |
| 6 Dijalog | pitanje | ugao 24, `dialog` 0,96 → 1 za 200 ms | otkaži zadatak |
| 7 Kontrola | taktilna | `materialControl.raised` → `inset`, ugao 12, meta 48 dp | čipovi, segmenti |
| 8 Predmet | sedi na svetlu, ne u kartici | senka je pečena u sliku; vektor: elipsa 20 × 3 na platnu 32 | S1 |

- **Toplina belog** nije nijansa nego mekoća: senke široke i niske (blur ≥ 12 iznad 3 dp pomaka, alfa ≤ 0,14), krem-beli predmeti na čisto belom ekranu, jedna narandžasta iskra po ekranu. Zabranjeno: mint, bež kartice, obojene senke, gradijent pozadine, staklo u sadržaju, kartica u kartici, isprekidana ivica.
- **Senka znači radnju**: zapis kaže „dodirni“, plutajuće „leži preko“, panel „iznad“. Što se samo čita nema senku.
- **2.5D senka**: predmet ima jednu kontaktnu senku, nikad dve (ni sopstvenu i kartice). Ugao zapisa 24, ikone u ležištu 12, krug samo za lica i dugmad u traci, kapsula za čipove.

## E. Pokret kao potpis

| # | Pokret | Šta radi | Trajanje, kriva | Kad | Reduced motion | Pravila |
|---|---|---|---|---|---|---|
| 1 | **Uskok** | red +8 dp → 0 i providnost; predmet uzlet 4 → −3 → 0, nagib −3° → 0° | 240 ms `easeOut`; 800 ms `arrive` | novi id, posle skeleta, prazno, trenutak | odmah gotovo | R1 R2 R4 R6 |
| 2 | **Dodir** | zapis se spusti kao *jedan predmet* (`usePressLift`): 0,97 dugme, 0,985 red i kartica | ulaz 120 ms `easeOut`; povratak opruga 400 ms ζ 0,85; red čeka 60 ms | svaki dodir; tik tek na otpuštanju | bez skale, tik ostaje | R5 R8 |
| 3 | **Susret** | dva elementa idu jedan ka drugom po 20 dp (lica u M2 po 40) i staju (par lica, „sada → novo“) | 240 ms `easeOut`, istovremeno | M2, predlog izmene | odmah | R1 R2 |
| 4 | **Žig** | skala 1,12 → 1 + providnost, senka, odjek prstena; tik na kontaktu | 180 + 120 ms, odjek 320 ms | samo potvrđen Dogovor | gotovo odmah, tik ostaje | R1 R2 R5 |
| 5 | **Dah** | oreol 1 → 1,8, providnost 0,35 → 0 | 1600 + 1600 ms (`loop.glow`) | samo stvarno živo, samo fokusiran ekran | statična tačka | R4 R7 |

Takti proizvoda: Uskok (Reci, Uskoči), Dodir (svuda), Susret + Žig (Dogovori), Dah (živo). Panel, dijalog i kamera ostaju na postojećim tokenima. Ne pomera se nikad: iznos, broj, vreme, reč stanja; razgovor 1:1 ostaje bez pokreta (test). Nema preskoka osim uzleta predmeta (slika, ne tekst). Svi pokreti su RN `Animated` na native driveru (B22). Bez zvuka (nije odobren).
**Novi tokeni (jedino mesto za brojeve; `one-token-source.test.ts` zabranjuje literal `duration:` van `tokens.ts`):** `sys.motion.moment` = `{ land: 180, fade: 120, echo: 320, from: 1.12, reachX: 20, reachFace: 40, bell: 150, star: 180, starGap: 40, shine: 420 }`; `sys.type.moment` (32/37, 700, −1,15); `sys.shadowX` = 1 (S5). Halo Daha koristi postojeći `loop.glow`, boje samo postojeće (`green`, `orangeSoft`). Svaki trenutak pri reduced motion: sve odmah, tik ostaje.

## F. Ilustracioni sistem

| Porodica | Šta imamo [K] | Gde | Napomena |
|---|---|---|---|
| Znak | `BrandMark` (U + stisak + pin + osmeh; ≥ 48 sirov atlas, < 48 vektor), `BrandLockup` (traka 112), atlas 2172 × 724, splash, pin zadatka | `entry/BrandAssets.tsx`, `assets/brand/` | zaključano; ne crtati ponovo |
| Činjenice (vektor) | 30 vrsta × 2 reza (ravni ≤ 24, nalepnica > 24) × 4 tona; kvačicu smeju `check`, `agreements`, `shield` | `FactArt.tsx` | 2.5D vraćen 8.10. |
| Sirovi predmeti (17) [K, pregledano na kontakt-listi] | pin (kobaltno plav pin, srebrna ivica), calendar (krem stoni kalendar, narandžasta traka, 4 ugljena polja), clock (bela satna, srebrni obod), users (plavo-siva figura), money (dve krem-zelene novčanice, čita se kao dolar), map (presavijena mapa, plava reka, smaragdni pin), tasks (krem tabla, tamnozelena štipaljka), agreements (smaragdno-krem lanac), offers (narandžasta etiketa sa kanapom), chat (plavi i beli panel), bell (biserno zvono, narandžasti jezičak), document (krem list, škriljasta ivica), support (slušalice, tamnoplavi jastučići), vehicle (beli kombi, narandžasta linija), tool (kutija, smaragdna drška, odvijač, ključ), remote (laptop, plavi ekran), publish (papir + smaragdni pin + narandžasta olovka) | `materialSubjects.ts`, `assets/illustrations/` | + `work-kit` (platnena torba, odvijač, ključ, zelene rukavice) i `discover-v2` nemapirani; najjača su `agreements`, `task-launch`, `work-kit`, `offers` |
| Mapa | pinovi: zadatak, mesto, skup (+ brojevi 1–4, izabrani) | `assets/discovery/` | P6, ne dirati |
| Likovi | robot asistent (bela školjka, tamnozeleni zglobovi, narandžasti detalji, crno lice sa svetlećim očima), jedna statična poza 24/88, providnost 240 ms | `assets/ai/`, `AiAssistantArt.tsx` | poze i Lottie fale |
| Catalog27 | brava, štit, dokument, podrška (+ Lottie proba) | `CatalogArt.tsx`, `CatalogMoment.tsx` | ozbiljni ekrani |
| Piktogrami | 46 za izbor (vozila, alat, usluge, ljudi), ≥ 32 dp | `Pictogram.tsx` | samo biranje, ne kategorija na kartici |
| Komande | `Glyph`, Phosphor regular, ≈ 35 imena | `Glyph.tsx` | nikad činjenica |
| Fotografije | ulaz: žena sa šoljom, majstor u kombinezonu (zaključano); u aplikaciji samo fotografija profila i zadatka u detalju | `assets/brand/entry-v49/` | |
| Pokret | `LottieArt` (omotač, nijedan fajl), `Arrive`, `SuccessMark` | `system/` | Lottie samo likovi i trenuci |

**Pravilnik predmeta (kratak brief za svaku novu sliku).** (1) Materijali: satenski emajl, krem papir, platno, kanap, četkani metal, keramika; nikad plastika, glina, staklo ni neon. (2) Boje: krem (oko #F2EEE6) + smaragd (porodica `green`) + narandžasta (porodica `orange`) + ugljeno sivo za detalj; plavo samo kad predmet znači lokaciju ili komunikaciju (`artRole`), koral ljude, zlato vreme. (3) Svetlo gore-levo, meka kontaktna senka dole-desno, 7–12 % providne margine, pogled 20° odozgo. (4) Silueta se prepoznaje zamućena na 48 dp (test). (5) Jedan predmet = jedno značenje; bez teksta, cifara, kvačice i tuđe marke. (6) Slika nikad ne tvrdi stanje (potvrdu, iznos, broj, dostupnost kaže tekst pored nje). (7) Isporuka i zapis kao u S1 (`PROVENANCE.json`: prompt + sha256).

**Što fali (za vlasnika da da ili odobri).**

| ID | Predmet, jedna rečenica | Prior. | Za šta |
|---|---|---|---|
| O1 | **Par**: dve zaobljene figure bez lica, jedna smaragdna i jedna narandžasta, ramena im se dodiruju (zamena za plavo-sivi `people-v2`) | P0 | tim i grupa, Dogovori prazno, „Kako radi“ |
| O2 | **Zvezda** (dve slike, puna i prazna): debela narandžasta emajlirana zvezda sa krem ivicom, prazna u krem emajlu | P0 | ocena, M4, primljene ocene |
| O3 | **Tri sloja zadatka**: krem papir sa dve udubljene sive linije, smaragdni pin i narandžasta olovka kao tri providne slike (razdvojen `task-launch-v2`; `pin-v1` je plav, ne sme u M1) | P0 | M1, Moji zadaci prazno, nacrt |
| O4 | **Papirni avion**: krem papir sa narandžastim pregibom, pod uglom (jedina činjenica bez 3D slike je `send`) | P1 | „Prijava je poslata.“ |
| O5 | **Stisak ruku** isečen iz originalnog logotipa 13524 (smaragdni i narandžasti rukav), vlasnikov materijal | P1 | Dogovori prazno, „Kako radi“ korak 2 |
| O6 | **Asistent, poze**: zdravo (maše), sluša, razmišlja, pita, spremno, bez veze; radni režim (kaciga, torba sa alatom); slojevi ili Lottie (vlasnikovi V28) | P0 | AI početak, M3, radni profil |
| O7 | **Lupa preko presavijene mape** | P1 | pretraga bez rezultata |
| O8 | **Iskopčan utikač**: krem utikač i utičnica, razmak ≈ 12 dp, smaragdna žica | P1 | nema veze, greška usluge |
| O9 | **Šoljica kafe sa parom**: krem keramika, narandžasta traka (srodna šoljici sa ulazne fotografije) | P1 | „Čekaš da neko uskoči“ |
| O10 | **Pečat-alat**: drveni ručni žig sa smaragdnom gumom | P2 | varijanta „udarac“ u M2 |

Napomene: Community Cast iz Master-a (4–6 likova) ne uvodim u UI; u UI su ljudi stvarna lica (S7), a O1 je konzervativna alternativa; odluka je vlasnikova. Zvonce se u M5 njiše transformom, bez nove slike. O1 menja ulogu „ljudi“ iz korala (`artRole.people` #D76B5C) u par iz logotipa (smaragd + narandžasta): odluka D6. `money-v3` se čita kao dolar: ako vlasnik želi, nova slika u istoj porodici (krem + smaragd) bez američkog dizajna; nije u listi jer je 3.10. prihvaćena (`INBOX_AND_NATIVE`).

## G. Ton i mikrotekst

Pravila: (1) „ti“ bez roda: „Tvoja prijava je izabrana“, „Ako te izaberu“, ne „Izabran si“. (2) Prvo šta se desilo, onda šta sledi; najviše dve rečenice. (3) Imenuj stvar: naziv zadatka, ime, termin, iznos, samo iz podataka; kad ih nema, ne izmišljaj („Prima ponude“ nije „0 RSD“). (4) „Uskoči“ za obećanje i radnju, ne za status sistema. (5) Jedan uzvičnik. (6) Bez tehničkog jezika: ishod, server, zahtev, aktuelno (`TEKSTOVI_REVIZIJA` zabranjene reči). (7) Ne obećavaj ono što telefon ne radi (push): „Javićemo ti“ → „vidiš ovde i u zvoncu“. (8) Toplina kroz konkretnost, ne kroz šalu: nema „Ups!“, nema emotikona (osim u odgovorima asistenta).

| # | Ekran | Pre | Posle |
|---|---|---|---|
| 1 | Objavljeno | „Prijave vidiš ovde i u zvoncu.“ | „Čim neko uskoči, videćeš ga ovde i u zvoncu.“ |
| 2 | Prijava poslata | „Ako tvoja prijava bude izabrana, odmah nastaje Dogovor. Prijavu pratiš u Mojim prijavama.“ | „Prijava je poslata. Ako te izaberu, odmah nastaje Dogovor.“ |
| 3 | Posle izbora | „Dogovor je sklopljen.“ | „Dogovoreno!“ + „Ti i Marko · 24. okt, 10:00–12:00 · 4.500 RSD.“ |
| 4 | Obaveštenje | „Nova prijava / Imaš novu prijavu za zadatak.“ | „Stigla je prijava / Montaža police u hodniku“ (R11) |
| 5 | Zadaci prazno | „Trenutno nema otvorenih zadataka. Kad neko objavi zadatak, videćeš ga ovde i na mapi.“ | „Još niko nije tražio pomoć. Čim neko objavi zadatak, pojaviće se ovde i na mapi.“ |
| 6 | Ocena sačuvana | „Ocena je sačuvana. Ova ocena ulazi u reputaciju naloga. Sačuvana ocena se ne menja.“ | „Hvala. Ocena je sačuvana. Pomaže drugima da biraju i ne može da se menja.“ |
| 7 | Dogovor, završetak | „Završetak je označen i čeka tvoju potvrdu. Bez odgovora se Dogovor zatvara sam.“ | „Zadatak je označen kao gotov. Potvrdi do 27. sep u 17:00, inače se Dogovor sam zatvara.“ |
| 8 | Nema veze | „Proveri internet vezu.“ | „Nema veze. Prikazano je poslednje što smo učitali.“ (R31) |
| 9 | AI polje | „Opiši šta ti treba“ (isto kao vrata i naslov) | „Napiši ili izgovori“ |
| 10 | Detalj zadatka, dugme | „Sastavi prijavu →“ | „Uskoči na zadatak“ (D2: prijava ostaje naziv predmeta) |

Odmah (samo klijent): 1, 2, 3 (deo „Dogovoreno!“), 5, 6, 7, 9, 10; server ili Edge uz „PRIMENI“: 4 (`taskTitle` u `rpc_list_inbox`, `private.notification_copy_v5`) i svi push tekstovi; 8 uz R31. Brzi odgovori u razgovoru (POTREBE P3): „Važi“, „Stižem za 10 min“, „Kasnim malo“: obične poruke, ne novo stanje.

## H. Pet potpisnih trenutaka

Zajedničko: ishod (M1, M2, M4) se igra samo posle potvrde sa servera, M3 nema ishod, M5 stiže iz stvarnog događaja (ekran odlučuje, scena samo igra: `MomentScene` iz Master-a); dugme je u stablu i prima dodir od prvog kadra (providno najviše 700 ms), nikad ne čeka kraj pokreta; sve su RN `Animated` kompozicije postojećih slika, bez nove zavisnosti (Lottie samo kad stignu vlasnikovi fajlovi: `LottieArt`, prvi kadar pri reduced motion); haptik kroz `tick()`, jedan po trenutku, na kontaktu.

Koji element nosi koji trenutak (● nosi, ○ postoji ali stoji):

| Trenutak | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 |
|---|---|---|---|---|---|---|---|---|
| M1 Objavljeno | ● | ● | | | ● | ● | | ● |
| M2 Dogovoreno! | | ● | ● | | ● | ● | ● | |
| M3 Prvi susret | ● | ● | | | | ● | | ● |
| M4 Prva ocena | ● | ● | | | ● | ● | | |
| M5 Stiglo je obaveštenje | ● | ● | | ○ | | ● | | |

### M1 · Objavljeno (≈ 0,7 s do mira; 1,5 s do nastavka = `PUBLISHED_MOMENT_MS`)
| t (ms) | Vidi se | Pomera se | Haptik |
|---|---|---|---|
| 0 | beo ekran; sloj „papir“ (O3) 120 dp na ≈ 38 % visine | Uskok: +8 dp, providnost, 240 ms | — |
| 120–300 | smaragdni pin (sloj O3) pada na papir | `translateY` −24 → 0, 180 ms `easeOut`; kontaktna senka 0 → 0,14 | — |
| 300 | pin dodirnuo papir | mir | `tick('success')` |
| 300–460 | olovka (sloj O3) stiže sleva | `translateX` −12 → 0 + providnost, 160 ms | — |
| 360–560 | „Zadatak je objavljen.“ (`title`) | Uskok 240 ms | — |
| 440–680 | „Čim neko uskoči, videćeš ga ovde i u zvoncu.“; zeleno „Otvori zadatak“ | providnost 180 ms | — |
| 1500 | prelaz na Zadaci, sopstveni pin izabran, traka „Poruka“ (postoji) | | |

Ostaje: predmeti miruju, nema petlje. Danas: `SuccessMark` 96 + `FactArt check` 64 u sivom krugu i njegov tik pri montiranju: tik daje samo scena (jedan). Reduced motion: sve odmah, tik ostaje; čitač ekrana: ne žuri (već). Bez O3: `task-launch-v2.png` ceo (jedan komad) kroz `Arrive` 800 ms, tik na kraju uzleta.

### M2 · Dogovoreno! (≈ 0,7 s do mira; ostaje dok ne dodirneš)
| t (ms) | Vidi se | Pomera se | Haptik |
|---|---|---|---|
| 0–240 | dva lica 56 dp na ≈ 32 % visine, jedno s leve, jedno s desne strane, sredina prazna (kao dvoje koji čine „U“) | Susret: `translateX` ±40 → 0 + providnost, 240 ms; staju 12 dp od budućeg prstena | — |
| 160–340 | žig Ø 112 u sredini između lica | skala 1,12 → 1 (180 ms) + providnost (120 ms); senka 0 → 1 | — |
| 340 | kontakt | odjek: prsten 1 → 1,35, 0,35 → 0, 320 ms | `tick('success')` |
| 300–540 | „Dogovoreno!“ (`display`/`moment`), ispod „Ti i Marko“ (`note`) | Uskok 240 ms | — |
| 380–620 | dva `FactRow` (termin sa „po vremenu u Srbiji“, iznos) | Uskok sa razmakom 40 ms | — |
| 520–700 | zeleno „Otvori Dogovor“ sredinom ekrana (ne na mestu dugmeta iz potvrde) | providnost 180 ms | — |

Ostaje: žig postaje prvi čvor koraka u pregledu (32 dp), par 40 dp u traci, prsten lica zelen. Druga strana: obaveštenje „Tvoja prijava je izabrana“ otvara Dogovor, a žig sleće **jednom** pri prvom otvaranju (pamćenje po ID-u kao `useAppear`), bez celog ekrana. Reduced motion: gotovo odmah, tik ostaje. Čitač ekrana: „Dogovoreno. Ti i Marko, 24. okt, 4.500 RSD“ (`announceForAccessibility`); žig je dekoracija.

### M3 · Prvi susret (od prvog ulaska u nalog do prve poslate rečenice; ulaz V4.9 i prijava ostaju kakvi jesu)
Cilj: prva rečenica (38 od prvih 62 razgovora nikad nije dobilo poruku, R18 [D], uzorak, ne dokaz uzroka).

| Korak | Vidi se | Pomera se | Haptik |
|---|---|---|---|
| 1 | Početna: dve pločice i „Kako radi“ (3 koraka, predmeti 48 dp: papir + pin, stisak ili lanac, zvezda) | vrata: `Arrive` predmeta 64 dp (odlaganje 80/200 ms); koraci `Appear` 40 ms | — |
| 2 | dodir „Objavi zadatak“ | prelaz 240 ms `easeOut`; asistent 88 dp providnost 240 ms (postoji) | `select` na otpuštanju |
| 3 | „Reci šta ti treba.“ + „Na primer“ (3 reda, uz svaki predmet 32 dp preko `openingArts`) | redovi `Appear` | — |
| 4 | dodir primera: rečenica u polju, fokus (već radi) | primer prelazi u `muted` | `select` |
| 5 | slanje: prva poruka i kartica „Nacrt“ | `Appear` samo za nov id | `light` na slanju |

Ostaje: asistent 24 dp uz svaki odgovor, kartica „Nacrt“; „Kako radi“ nestaje za stalno posle „Sakrij“ (postoji). Asistent maše tek kad stigne vlasnikov Lottie (O6); do tada statičan.

### M4 · Prva ocena (davanje; primanje je red na kraju)
| t (ms) | Vidi se | Pomera se | Haptik |
|---|---|---|---|
| 0 | lice osobe, „Kako je prošla saradnja?“, pet zvezda 40 dp (razmak 8, meta 48), prazne krem | — | — |
| tap na N-tu | zvezde 1..N postaju pune narandžaste | redom, 40 ms razmaka, svaka skala 0,8 → 1 za 180 ms `easeOut` (ukupno ≤ 340) | jedan `select` na otpuštanju |
| „Sačuvaj ocenu“ | spiner samo u dugmetu | — | — |
| server potvrdio | isti raspored, naslov „Ocena je sačuvana.“ | prelaz sadržaja 180 ms; beli sjaj (traka 24 dp) prelazi preko punih zvezda `translateX`, 420 ms `easeOut` | `tick('success')` na početku sjaja |

Ostaje: zvezde stoje (bez petlje). Primanje: obaveštenje „Stigla ti je nova ocena“ otvara Primljene ocene; nov red `Appear`, zvezda 32 dp. Reduced motion: bez sjaja i redosleda, tik ostaje. Zvezde: nova slika O2 (puna i prazna), ne bojenje jedne.

### M5 · Stiglo je obaveštenje
| t (ms) | Vidi se | Pomera se | Haptik |
|---|---|---|---|
| 0 (aplikacija otvorena) | zvonce u traci | zanjiše se oko vrha (pivot: `translateY` −r, `rotate`, `translateY` +r): 0 → −14° → +10° → −6° → 0, 4 × 150 ms `easeOut`, jednom | `select` |
| 0–180 | narandžasta tačka 10 dp na zvoncu | skala 0 → 1, 180 ms | — |
| 80–320 | traka „Poruka“: znak vrste 24 dp, „Stigla je prijava: Montaža police u hodniku.“, zeleno „Otvori“ | 8 dp + providnost, 240 ms; stoji 6 s | — |
| dodir „Otvori“ | ciljni ekran sa označenim redom | prelaz 240 ms; red: `orangeSoft` 0 → 1 za 120 ms, nazad za 900 ms, jednom | — |

Iz sistemskog obaveštenja (hladan start ili pozadina): isti označeni red, bez trake; tekst na zaključanom ekranu ostaje bez naziva zadatka (A20). Ostaje tačka do čitanja. Reduced motion: zvonce stoji, tačka i traka odmah, red označen 1,2 s pa gasi. Zavisi od push-a (poslednji po planu); „Poruka“ unutar aplikacije radi i bez njega.

## I. Ekran → potpisni element → mala promena koja ga čini našim

| Ekran | Nosi | Mala promena |
|---|---|---|
| Ulaz V4.9 | (zaključano: znak, fotografije, kurziv slogan) | ne dira se; prvi ekran posle prijave je M3 |
| Prijava, registracija | S6, S1 | `BrandMark` 56 iznad naslova, statičan; naslov „Prijavi se ili napravi nalog“; jedan zeleni glagol |
| Oporavak lozinke | S8 | ključ (`CatalogArt`) 48 dp, jedna rečenica, „Zatraži novi link“ |
| Dozvole u kontekstu | S1, S6 | predmet 64 dp po dozvoli (zvonce, pin, kamera), jedna rečenica zašto, „Dozvoli“ / „Ne sada“ |
| Početna | S1, S2, S4 | `Arrive` predmeta prvi put; „Čeka te“: ista vrsta = isti predmet; Dah na profilu kad je „Slobodan sam sada“; lab varijanta B: predmet 72 dp izlazi 8 dp iznad ivice vrata (visina 88 ostaje; traži vlasnikovu reč jer je Početna potvrđena 6.10.) |
| Početna, prvi dan | S8, S1 | tri predmeta 48 dp umesto tri mala znaka, „Sakrij“ ostaje |
| Obaveštenja | S1, S6 | predmet 32 po vrsti, naziv zadatka u naslovu (R11), nov red Uskok, zvonce se njiše (M5) |
| Poruke (lista) | S7 | lice 56 sa „nalepnica“ ivicom; grupa = Par (O1); nepročitano = narandžasta tačka, ne crn brojač |
| Razgovor | S7, S6 | Par 40 u zaglavlju; prazno: `chat` 96 + „Dogovori vreme i mesto“; „Važi“ prvi brzi odgovor; pokret ostaje nula (test) |
| Zadaci (mapa) | S1, S5 | izabrani pin: kontaktna senka 12 × 4, 1,06× (postoji); pilula i zum u plutajućem sloju |
| Kartica zadatka, peek | S1, S5, S6 | činjenice 28 dp 2.5D (postoji); iznos kao „broj“ (700 tabular + RSD meta); „Prima ponude“; dodir spušta celu karticu |
| Pretraga, filteri | S5, S6 | čipovi uzdignuto → utisnuto; grad = pin 28 dp 2.5D; „Prikaži 41 zadatak“ jedina zelena |
| Detalj zadatka | S7, S6 | „Objavio“: lice 56 sa ivicom; zeleni glagol „Uskoči na zadatak“ (D2); bez velikog predmeta (informacioni ekran) |
| Pitanja i odgovori | S6 | „Tvoje pitanje · čeka odgovor“; bez predmeta |
| Prijava (forma) | S6, S2 | dugme siva → zelena za 180 ms kad je spremno, razlog iznad; zaglavlje sa činjenicama 28 dp |
| Prijava poslata | S1, S2 | papirni avion 96 (O4; do tada vektor `send`) umesto sivog diska + kvačice; `tick('success')` |
| Moje prijave | S1, S8 | prazno: `offers` 96 (etiketa); „Izabrana“ ostaje čip (žig je samo za Dogovor) |
| Moji zadaci | S8, S5 | prazno: `publish` 96 kroz `Arrive`; zapis ≈ 200 dp; „Bira se · 3“ narandžasta tačka stoji |
| Moj zadatak | S6, S1 | „Čekaš da neko uskoči. Prijave vidiš ovde i u zvoncu.“ + šoljica O9 48 dp |
| Kandidati | S7, S6 | lice 56 + ocena + iznos kao „broj“; poruka u navodnicima „…“; „Najbolje ocenjeni“ |
| Jedna prijava, potvrda izbora | S7, S3 | potvrda ima Par (2 lica) iznad rečenice; posle servera M2 |
| Dogovori (lista) | S7, S1 | lice 40; prazno: lanac `agreements` 96 + „Dogovor nastaje kad izabereš prijavu ili te izaberu.“ |
| Dogovor, pregled | S7, S3, S4 | Par 40 u traci; prvi čvor koraka = žig 32; „Dogovoreno ukupno“ 24/30 kao broj (već); „U toku“ sa Dah tačkom |
| Izmene i otkazivanje | S6, S2 | „sada → novo“ kroz Susret 240 ms; čipovi razloga; bez predmeta |
| Potvrda završetka | S6 | panel sa Parom i jednom rečenicom; posle: „Poruka“ + `tick('success')` |
| Ocena | S1, S2 | M4: zvezda 3D 40 dp; čipovi uzdignuto → utisnuto |
| Raspored, Arhiva | S5, S6, S8 | izabrani dan ostaje zelen; prazan dan = jedan `note`; arhiva prazno: `calendar` 96 |
| AI razgovor (nova) | S1, S8, S2 | asistent 88 (+ poze O6); primeri sa predmetom 32; M3 |
| Pregled pre objave | S6, S5 | neaktivno = siva podloga + razlog iznad; kad je spremno, toggle 180 ms u zeleno |
| Objavljeno | S1, S2 | M1 (papir, smaragdni pin i olovka kao slojevi, O3) |
| Mesto, fotografije zadatka | S1, S8 | mesto: pin predmet, bez maskote (mapa je UI-dominantna); fotografije prazno: `photo` 96 |
| Profil | S7, S4 | lice 96 sa ivicom i prstenom; slova `greenEdge`; „Kako mogu da uskočim“ sa `work-kit` 40; Dah na avataru |
| Radni profil, AI razgovor | S1, S8 | `work-kit` 96 + asistent radni režim (O6); „Na šta ovo utiče“ |
| Područje rada, Dostupnost | S4, S6 | „Slobodan sam sada“ + Dah; „Mogu odmah“ ističe (R06) |
| Ime i fotografija | S7 | pregled lica 96 sa ivicom |
| Podešavanja obaveštenja | S1, S6 | tri izbora (R33) + zvonce 32; bez dekoracije |
| Privatnost, Izvoz, Zatvaranje naloga, Pravila | S6 | `CatalogArt` 32–48 (brava, štit, dokument); ozbiljno: bez scene (Master NONE) |
| O aplikaciji | S1 | veliki lockup (postoji) + „Pomoć počinje dogovorom.“; verzija samo u pravnom delu |
| Blokirani, Bezbednost | S6 | UI-dominantno; ime osobe u naslovu; bez predmeta |
| Podrška | S8, S6 | `support` 96; „Najčešća pitanja“; bez obećanja roka |
| Javni profil (panel) | S7 | lice 72 sa ivicom; „4,8 · 12 ocena“; samo stvarne oznake poverenja |
| Primljene ocene, Moja statistika | S1 | zvezda 3D 32 u zaglavlju (O2); brojevi kao „broj“ |
| Stanja (prazno, greška, nema veze, učitavanje) | S8 | greška i nema veze: topao predmet (O8), bez `Arrive`; skelet = geometrija reda, diše 700 ms |
| Traka „Poruka“ | S2, S6 | znak vrste 24 dp levo, tekst ≤ 12 reči, 4 / 6 s (postoji) |
| Paneli i dijalozi | S5 | ugao 28 / 24, bez preskoka, rukohvat 36 × 4, jedan panel odjednom |
| Donja i korenska traka | S1, S4 | „Dogovori“ = glifa Handshake (postoji); značka „čeka te“ narandžasta (R13); lockup 112 ostaje jedini znak na traci |

## J. Odluke vlasnika, šta nisam uzeo, redosled

**Odluke (svaka da / ne / izmena):** D1 osećaj „Važi.“ i rečenica iz A · D2 dugme „Uskoči na zadatak“ umesto „Sastavi prijavu“ (rečnik: prijava ostaje naziv predmeta) · D3 jedan uzvičnik u aplikaciji: „Dogovoreno!“ · D4 žig (zaključani znak U u prstenu) kao ceo ekran posle izbora prijave i kao prvi čvor koraka · D5 koje od O1–O10 odobravaš (P0: O1, O2, O3, O6) i ko ih daje (V28 Lottie i stisak iz logotipa tvoj materijal, ostalo ugrađeni generator; plaćen izvor pojedinačno) · D6 Par: zameniti plavo-sivi `people-v2` parom iz logotipa (menja ulogu „ljudi“ iz korala u smaragd + narandžastu) i dodati prsten stanja na licima · D7 tačka koja diše na avataru dok je „Slobodan sam sada“ (zelena diše, narandžasta čeka) · D8 svim senkama +1 dp horizontalni pomak (ostaju neutralne). Parkirano: Inter Italic (nove datoteke u buildu), osmeh iz logotipa (luk) kao indikator izbora u traci.

**Namerno nije uzeto:** nagib znaka ili predmeta u mirovanju; kost, bež i Onest; rukopisni font ili „potez pera“ na ekranima; boja po ulozi (zeleno = tražiš, narandžasto = uskačeš; kosi se sa tabelom boja, ostaje samo u slici znaka); konfeti na „Dogovoreno!“; maskota na mapi, filterima, bezbednosti, privatnosti i brisanju; Lottie za dugmad i činjenice; staklo i zamućenje u sadržaju; pulsirajuća pozadina i shimmer; zvuk (nije odobren); novi font.

**Ako vlasnik potvrdi D1–D4, u AGENTS 3.6 bi ušle četiri rečenice** (njegova odluka; ovaj dokument ništa ne menja): jedan predmet po ekranu; jedan uzvičnik u aplikaciji, „Dogovoreno!“; zelena tačka diše, narandžasta čeka; žig i svaki trenutak samo posle potvrde servera.

**Redosled (najjeftinije prvo):** (1) osam brzih izmena sa postojećim predmetima, ispod · (2) umetnost O1, O2, O3, O6 · (3) M1 + M2 sa S3 i S7 (M, ≈ 5 d) · (4) M4, M5 · (5) S4, S5 (S).
**Osam brzih izmena bez nove umetnosti (S, ≈ 2 d):** (a) svaki ekran prosleđuje `StateView` *svoj* postojeći predmet: Moji zadaci `publish`, Moje prijave `offers`, Dogovori `agreements`, Poruke `chat`, Obaveštenja `bell`, Raspored i Arhiva `calendar`, Zadaci `map`, podrška `support`, fotografije `photo`; `Arrive` već svira · (b) `openingArts` za tri primera u AI razgovoru (podržano, niko ne prosleđuje) · (c) `useAppear({afterLoading})` u 3 liste koje ga nemaju (Moji zadaci, Moje prijave, Obaveštenja) · (d) slova `Avatar` u `greenEdge` (5,75:1 umesto 4,25:1) · (e) brojač nepročitanog u Porukama u narandžastu (tabela boja) · (f) tekstovi iz G 1, 2, 3, 5, 6, 7, 9, 10 (klijent; 4 i push traže „PRIMENI“, 8 uz R31) · (g) traka „Poruka“ sa znakom vrste 24 dp (`FactArt`) · (h) `SuccessMark`: tik sa montiranja na kontakt (MOTION M-03, M-05).
**Preklapanja sa paralelnim dokumentima** (pregledano samo zaglavlje): R3 predlaže predmet koji prelazi ivicu pločice (kod mene lab varijanta B za Početnu), prazna stanja kao scene (S8) i trenutke bez sivog diska (M1, M2); `AIRBNB_OSECAJ_SPEC` traži veći predmet u prvom susretu i trenutku (kod mene 96–160 dp). R3 pominje 10 trenutaka, ovde je 5 po zadatku; pri sintezi spojiti ID-ove da se Žig i Uskok ne dupliraju.
**Laboratorija prvo (3 scene):** Početna (vrata A/B, prvi dan) · pregled Dogovora sa Parom, Žigom i kadrovima M2 · M1 i M4 kao scene za RN `Animated` u webu (pokret se u labu vidi, haptik i 60 fps ne).
**Granice.** Pristupačnost: predmeti i žig su dekoracija (tekst pored njih nosi značenje), Dah ima tekst „Slobodan sam sada“, trenuci se čitaju kao jedna rečenica; reduced motion čita jedini izvor `ui/system/motion`. Ništa ovde nije provereno na uređaju (kadrovi, haptik, 60 fps su [?]); snimci su web sa lažnim podacima i bez skaliranja teksta; kod se pomera (drugi agenti rade u istom stablu), pa `fajl:red` važi za čitanje oko 07:00.
