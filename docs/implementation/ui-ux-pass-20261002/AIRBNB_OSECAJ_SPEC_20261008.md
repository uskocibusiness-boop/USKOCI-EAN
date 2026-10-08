# USKOČI — Airbnb osećaj: izgled, svrha i jasnoća po ekranu (dizajn-vođa, 8. oktobar 2026)

Samo čitanje + ovaj jedan dokument (model: Sonnet 5.5, nasleđen od roditelja). Nijedan fajl projekta, server, DEV, telefon ni emulator nisu dirani; nisam pokretao laboratoriju ni testove: čitao sam gotove PNG-ove i izmerio piksele Airbnb snimaka malom skriptom u privremenom folderu van repozitorijuma. Predlog je za agente koji sprovode ekrane, ne novo odobrenje. AGENTS.md 3.5–3.6 važe: bele površine, crn glavni tekst, siva podrška, JEDNA zelena radnja po ekranu (narandžasta samo akcenat), tekst najmanje 12, „ti“ bez roda, „zadatak“, bez internih naziva strana u tekstu, bez izmišljenih podataka, ulaz V4.9 i HOME potpis zaključani, nova zavisnost zabranjena, Lottie samo za likove i trenutke. Dokument je duži od ~350 redova jer sadrži tri pojašnjenja vlasnika (ispod).

**Šta je vlasnik rekao (dekodirano, u tri koraka).** (1) Iz Airbnb-a se uzima SAMO izgled kartica i ekrana, lepota i jasnoća; nijedna funkcija, sadržaj ni tok; cilj je da SVI naši ekrani izgledaju najbolje, ne samo oni koji liče na snimke; 2.5D ikonice se vraćaju. (2) Gledati stil, premium izgled i kompoziciju, i KAKO je to osmišljeno prema tome čemu Airbnb služi i šta korisniku treba: sve je jasno i nimalo zbunjujuće; isto za USKOČI. (3) Svaki ekran se oblikuje i usklađuje po svojoj nameni, do detalja: raspored sledi svrhu (kartice ili ne), pokret takođe.

**Oznake.** (M) izmereno na originalu 1264 × 2728, ±1 dp · ≈ procena · (K) pročitano u kodu `USKOCI-CLEAN-spoj-20261006/src` (radno stablo, nekomitovane izmene drugih agenata) · P1–P11 su predlozi iz odeljka 3.1.

**Skala (važno, odstupa od zadatka).** Zadatak je dao 927 px = 412 dp (2,25 px/dp). Original je 1264 px, a telefon vlasnika je 560 dpi = 361 dp širine (isto kao u KOMPOZICIJA spec-u: „420 px = 361 dp“). Dokaz sa samih snimaka: pilula je 196 px, ivica 84 px, tab traka 195 px, dugme 168 px; na 3,5 px/dp to je 56,0 · 24,0 · 56,0 · 48,0 dp (okrugli Airbnb brojevi), a na 3,07 px/dp (412 dp) bilo bi 63,8 · 27,4 · 63,5 · 54,7. Zato su SVE mere ovde u dp na 361 dp (1 dp = 3,5 px originala = 2,57 px na prikazanoj slici od 927 px). Naš laboratorij crta 412 × 915 (1 dp = 2 px): dp ostaju dp, samo razmere „% širine“ računam na 361. Tekst je izmeren kao visina reda (ascender–descender), pa su „sp“ približni i uključuju veličinu fonta telefona.

## 0. Zaključak

Airbnb nije bogatiji funkcijama nego krupniji i mirniji tamo gde treba. Naš ritam je već blizu (pilula 56, radijusi 12/24/28/pun, tab traka ≥ 56, jedna zelena radnja, `Section`/`ListRow`/`Surface`); razlika je u pet stvari:
1. **Razmera predmeta.** Airbnb prvi susret crta predmetom 140–219 dp (39–61 % širine); naš `StateView` ima kutiju 96 (≈ 27 %, vidljivo ≈ 62 × 88 za tablu).
2. **Bogatstvo.** Njihov 3D predmet stoji i u čipu (≈ 19), toastu (≈ 22), pločici profila (≈ 58) i zaglavlju pretrage (≈ 53); naše ravne oznake ≤ 24 dp (`MARK_MAX_SIZE`) su tim-podrazumevano koje je vlasnik sada odbacio.
3. **Vrh Profila.** Veliki identitet (lice 104) umesto malog levog (72) i ulazne pločice 150 × 150.
4. **Pretraga** kao niz zasebnih kartica na zamućenju (a ne jedan list sa linijama).
5. **Trenuci** („Objavljeno“, „Dogovoreno!“) sa jednim velikim predmetom i jednim dugmetom, bez sivog diska.

Pošto zadaci nemaju obaveznu fotografiju, naša „fotografija“ je 2.5D predmet: zato mora biti veliki tamo gde osoba stiže (prvi susret, trenutak) i lep a mali tamo gde se čita (činjenice, redovi). Jedanaest izmena (P1–P11) pokriva to: osam je potpuno „odmah“ (P1, P2, P6–P11), jedna je „odluka vlasnika“ (P5), a P3 i P4 imaju deo „odmah“ i deo koji traži vlasnika (novi crtež, pločice). Načela koja važe za svaki ekran su na kraju (odeljak 6).

## 1. Šta vidim (11 Airbnb snimaka)

**Merna lestvica Airbnb-a (M, dp na 361).**

| Element | Mera | Napomena |
|---|---|---|
| Ivica · odeljak ↔ odeljak · kartica ↔ kartica · čip ↔ čip · traka kartica | 24 · 24 · 16 · 8 · 12 | naš ugovor (`layout.ts`): 20 · 24 · 12 · 8 · 12 |
| Pilula pretrage | 313 × 56, pun radijus, natpis ≈ 16 polucrn centriran, lupa 20 | meka senka |
| Čip sa predmetom · čip filtera (ivica 1 dp) | 41 · 34 | predmet ≈ 19 u kutiji 24 |
| Tab traka · ikona · natpis | 56 · 24 · ≈ 11 | aktivan: boja brenda + polucrn, bez indikatora; linija 1 dp gore |
| Dugme: široko crno · uvučeno u boji brenda | 312 × 48 · 151 × 56 ili 141 × 48, radijus ≈ 12 | natpis ≈ 16 polucrn |
| Okrugla dugmad zaglavlja · dugme-strelica u sekciji | 40 (#F2F2F2) · 28 | |
| Polje · pločica ikone · red „Kada/Ko“ | 56 (≈ 12, ivica 1,2) · 56 (≈ 12) · 60 (≈ 16) | |
| Kartica: velika · pločica profila · fotografija | ≈ 24 · ≈ 24 · ≈ 16–20 | meka senka, ivica jedva vidljiva |
| Panel odozdo | gornji uglovi ≈ 28; rukohvat 28 × 4 (Putovanja) / 40 × 4 (rezultati) | |
| Lebdeća poruka | 313 × 52, ≈ 16, predmet 22, 24 iznad tab trake | |
| Predmet: prvi susret · trenutak u panelu · pločica profila | 140 × 153 i 219 × 157 · ≈ 78 · ≈ 58 | |
| Tekst (ekran telefona) | veliki naslov ≈ 32 · naslov odeljka ≈ 20 · naslov praznog ≈ 22 · tekst ≈ 16/21 · sporedno ≈ 14 | |
| Red liste · ikona · strelica | 56 · 24 linijska · 8 × 15; tekst na 64 od ivice | |

### 1.1 Početna + panel „Sada ćete videti jednu cenu…“ (`dcb8e106`)
**Svrha ekrana i šta korisnik hoće ovde:** jednom i mirno objavljuje promenu koja menja novac, pa vraća korisnika u ono što je radio; hoće da shvati „šta je novo“ za tri sekunde i da nastavi.
**Kako kompozicija to služi:** veliko — rečenica (3 reda) i predmet; malo — sve ostalo; skriveno — ništa ne nestaje, početna ostaje vidljiva zatamnjena ≈ 45 % (kontekst ostaje); JEDNA radnja — crno „Važi“ preko cele širine; namerno izostavljeno — drugo dugme, „Saznaj više“, više rečenica, naslov nad predmetom.
- (M) Panel počinje na 342 dp (44 % visine 779), gornji uglovi ≈ 28, boja topla hartija #F3F2ED; „×“ je glif 12 u dodirnoj meti ≈ 48, 32 dp ispod vrha panela.
- (M) Predmet (etiketa sa vrpcom) ≈ 78 × 78, centriran, 83 dp ispod vrha panela; naslov 3 reda centrirano, razmak redova 28 (≈ 22–24 sp, srednja težina), 51 dp ispod predmeta.
- (M) Dugme 312 × 48 (ivica 24), radijus ≈ 12, #222222, natpis ≈ 16 polucrn; 47 dp ispod naslova i 62 dp iznad dna ekrana (uključuje sistemsku traku).
- (M) Početna ispod je ista kao na slici 2 (pilula 313 × 56, čipovi 41): panel ništa ne pomera.

### 1.2 Početna, vrh (`9548af1d`)
**Svrha ekrana i šta korisnik hoće ovde:** „nastavi gde si stao ili počni pretragu“; korisnik hoće jedan dodir do cilja i brzu promenu vrste.
**Kako kompozicija to služi:** veliko — pilula 56 i predmeti u čipovima; malo — sav tekst 14–16; skriveno — filteri (iza pilule), ostale kategorije (bočni skrol, treći čip viri); JEDNA radnja — pilula „Započnite pretragu“ (nijedno obojeno dugme); izostavljeno — logo, naslov ekrana, zvonce, profil (nosi ih tab traka).
- (M) Pilula 313 × 56 (x 24–337, y 51–107), bela na gradijentu #E3E3E3 → bela u prvih ≈ 130 dp, natpis ≈ 16 polucrn centriran uz lupu 20; čipovi 41 visine, razmak 8, 17 ispod pilule, predmet ≈ 19; izabran „Sve“ = utonuo bunar #E0DFDD.
- (M) Kartica „Nastavite…“: 313 × 130, 24 ispod čipova, tekst na 21 od leve ivice, naslov ≈ 16 polucrn 3 reda × 19, sporedno ≈ 14 sivo, sličica (dve fotografije pod uglom) 81 × 77 na 16 od desne ivice.
- (M) „Nedavno gledano“ ≈ 20 polucrno + okruglo dugme-strelica 28 (#F2F2F2), 24 iznad prethodnog bloka, 14 do kartica; kartice 116 × 111, razmak 12, treća viri.
- (M) Lebdeća poruka 313 × 52 (y 625–677), ≈ 16 radijus, predmet ≈ 22 + natpis ≈ 16 polucrn, 24 iznad tab trake; tab traka od 701 dp: ikone 24, natpis ≈ 11, aktivan = boja brenda.

### 1.3 Početna, skrol (`85764be2`)
**Svrha ekrana i šta korisnik hoće ovde:** otkrivanje po temama; korisnik hoće da prelistava bez gubljenja pilule i čipova.
**Kako kompozicija to služi:** veliko — fotografije; malo — natpisi; skriveno — ostale kartice u bočnom skrolu (sledeća viri), cene i ocene tihe; JEDNA radnja — dodir kartice; zalepljeno — zaglavlje; izostavljeno — dugmad „Rezerviši“, objašnjenja uz sekciju.
- (M) Zaglavlje (pilula + čipovi) lepljivo do 183 dp sa senkom; sadržaj klizi ispod, bez promene pilule.
- (M) Kartice 150 × 143, dve u redu + treća viri (razmak 12), radijus ≈ 16, srce 24 gore desno; naslov ≈ 16 polucrn 1 red, cena ≈ 14 siva.
- (M) Naslov sekcije 2 reda ≈ 20 polucrno + okrugla strelica 28 uz prvi red; razmak sekcija ≈ 29 (24–32); značka „Gostima omiljeno“ 69 × 41 je prelomljena u 2 reda (sitna mana koju ne kopiramo).

### 1.4 Početna, izabran čip „Domovi“ (`19043efd`)
**Svrha ekrana i šta korisnik hoće ovde:** suziti prikaz jednom dodirom; korisnik hoće trenutan, vidljiv odgovor bez novog ekrana.
**Kako kompozicija to služi:** menja se samo čip; JEDNA radnja — sam čip; izostavljeno — boja brenda na čipu, kvačica, podvlaka, pomeranje rasporeda.
- (M) Izabrani čip je utonuo bunar #E0DFDD iste veličine (41); „Sve“ se vratio na belo sa senkom.
- (M) Nijedan element ispod se ne pomera (kartica „Nastavite…“ ostaje na 188 dp, traka na 384 dp).
- Izbor se čita iz oblika (utonuo naspram izdignut), ne iz boje.

### 1.5 Putovanja: mapa + prazan panel (`0df38db8`)
**Svrha ekrana i šta korisnik hoće ovde:** kaže da ovde ništa nema dok korisnik nešto ne rezerviše, i zašto bi se vratio; hoće da zna da nije pokvareno i šta ga čeka.
**Kako kompozicija to služi:** veliko — dioram 219 × 157 (61 % širine) i naslov; malo — pasus; skriveno — dugme je ispod preloma (nije na snimku), mapa gore je odskočna daska; izostavljeno — lista, filteri, brojevi.
- (M) Panel počinje na 312 dp (40 %), uglovi ≈ 28–36, rukohvat 28 × 4 (#8C8C8C); predmet 219 × 157, centriran, 63 dp ispod vrha panela.
- (M) Naslov 2 reda ≈ 22 polucrno, razmak 26, 36 dp ispod predmeta; pasus 3 reda ≈ 16/21 sivo, 23 dp ispod naslova.
- (M) Pinovi na mapi: pločica ≈ 30 × 27 + šiljak (30 × 33), pastelna podloga (roze/zelena/siva/plava) sa linijskom ikonom iste nijanse ≈ 20; imena gradova ≈ 15 polucrno sa belim oreolom.

### 1.6 Putovanja: mapa (`61e2ad80`)
**Svrha ekrana i šta korisnik hoće ovde:** pregled mesta; korisnik hoće da vidi gde je šta i da dohvati jedno mesto.
**Kako kompozicija to služi:** veliko — mapa preko cele visine; malo — pinovi i imena; skriveno — panel spušten na rukohvat + prvi naslov; JEDNA radnja — dodir pina; izostavljeno — pilula, čipovi, dugmad.
- (M) Panel spušten: vrh na 685 dp (88 %), vidi se rukohvat + prvi red naslova (≈ 94 dp).
- (M) Pin 30 dp (+ šiljak), imena ≈ 15 polucrno; preklapanje pinova se rešava slaganjem, bez klastera.
- Mapa u blagoj zeleno-plavoj stilizaciji, logo „Google“ dole levo; nijedan kontrolni element preko mape.

### 1.7 Rezultati pretrage (`730e907e`)
**Svrha ekrana i šta korisnik hoće ovde:** poredi ponude po mestu i ceni; korisnik hoće da vidi cenu i mesto odmah i da otvori jednu.
**Kako kompozicija to služi:** veliko — mapa sa cenovnim pilulama i prva kartica 313 × 236; malo — filter čipovi; skriveno — preko 1000 rezultata iza jednog reda „Preko 1000 domova“; tab traka nestaje (ceo ekran je rad); JEDNA radnja — otvori karticu; filteri su čipovi; izostavljeno — naslov ekrana, zasebno dugme „Filteri“ (ikona u pilulji).
- (M) Traka: strelica nazad (ivica 24), pilula 209 × 56 (x 72–281) sa dva reda (≈ 16 polucrno + ≈ 14 sivo), ikona filtera 24 desno.
- (M) Čipovi filtera: ivica 1 dp, bela bez senke, 34 visine, razmak 8, prvi počinje na 32; cenovna pilula ≈ 105 × 36, ≈ 18 polucrno, bela sa senkom.
- (M) Panel: vrh 422 dp (54 %), rukohvat 40 × 4; „Preko 1000 domova“ ≈ 16 srednje centrirano; fotografija 313 × 236 (4:3), radijus ≈ 16–20, značka gore levo (visina 36), srce 24 gore desno, 5 tačkica.

### 1.8 „Gde?“ (`bb955afc`)
**Svrha ekrana i šta korisnik hoće ovde:** pretraga u tri kratka koraka; korisnik hoće da otkuca mesto ili uzme nedavnu pretragu i što pre pritisne „Pretraga“.
**Kako kompozicija to služi:** veliko — otvoren korak „Gde?“ (kartica 337 × 368); malo — „Kada“ i „Ko“ kao zatvoreni redovi 60 dp; skriveno — kalendar i broj gostiju dok korak nije otvoren; JEDNA radnja — „Pretraga“ 141 × 48 dole desno, „Obriši sve“ je samo tekst; izostavljeno — objašnjenja, više otvorenih koraka, skrol pozadine (zamućena).
- (M) Kartica x 12–349, y 141–509, radijus ≈ 24, unutra 24; polje 289 × 56 (ivica 1,2 #8C8C8C, ≈ 12); naslov „Gde?“ ≈ 26 polucrn; gore 3 kategorije (predmet ≈ 53, natpis ≈ 16, podvlaka 3), „×“ krug 40 beo sa senkom.
- (M) „Nedavne pretrage“: pločica 56 × 56 (≈ 12; #FCF8F9 sa linijskom ikonom ili #F5F5F5), 16 do teksta (≈ 18 polucrno + ≈ 16 sivo), korak 72; kartica se skroluje i seče na dnu.
- (M) „Kada“/„Ko“: 329 × 60 (x 16–345), ≈ 16, razmak 16 (i 16 ispod kartice); oznaka ≈ 16 siva levo, vrednost ≈ 16 polucrna desno.
- (M) Dno: „Obriši sve“ ≈ 16 polucrno (24 od leve ivice) + dugme 141 × 48 (≈ 12, #E2445B → #D53853).

### 1.9 Poruke, prazno (`bf25c09a`)
**Svrha ekrana i šta korisnik hoće ovde:** kaže zašto je prazno i kako dobiti prvi razgovor; korisnik hoće da zna da nije pokvareno i šta da uradi.
**Kako kompozicija to služi:** veliko — naslov ≈ 32 i predmet 140 × 153; malo — pasus; skriveno — pretraga i podešavanja u dva okrugla dugmeta gore desno, „Prethodne prepiske“ ispod linije; JEDNA radnja — „Započnite“ 151 × 56 centrirano, ne preko cele širine; izostavljeno — drugo dugme, uputstvo, lista.
- (M) Dugmad 40 (#F7F7F7), razmak 8; naslov „Poruke“ ≈ 32 polucrno; predmet 140 × 153 (39 % širine), vrh na 207 dp (26 % visine).
- (M) „Ovde nema ničega“ ≈ 22 polucrno, 44 dp ispod predmeta; pasus 3 reda ≈ 16/21 sivo, 22 ispod naslova, širina ≈ 290.
- (M) Dugme 151 × 56 (širina po sadržaju, ≈ 12, boja brenda), 60 dp ispod pasusa (y 563–619, 72–79 % visine); razdelnik 1 dp (24 → 337) na 643, ispod red „Prethodne prepiske“ ≈ 18 sivo + strelica.

### 1.10 Profil (`1441bb98`)
**Svrha ekrana i šta korisnik hoće ovde:** pokazuje ko sam i daje ulaz u dve-tri glavne stvari; korisnik hoće potvrdu identiteta i brz ulaz u ono što koristi.
**Kako kompozicija to služi:** veliko — identitet (lice 104) i dve kvadratne pločice 150 × 150; malo — natpisi; skriveno — podešavanja ispod preloma kao lista (slika 11); JEDNA radnja — nijedna istaknuta (kartice su ulazi, „NOVO“ vodi pogled); izostavljeno — dugme „Izmeni“, brojke.
- (M) Naslov „Profil“ ≈ 32, zvonce 40 (#F2F2F2) na 16 od desne ivice; kartica identiteta 313 × 236 (y 165–401), padding gore 32, lice 104 (#FAE6E7, slovo ≈ 44 tamnoroze), ime ≈ 32 polucrno 16 ispod, uloga ≈ 16 sivo.
- (M) Pločice 150 × 150, razmak 16 (i 16 od kartice identiteta); predmet ≈ 58 centriran 11 od vrha; „NOVO“ 46 × 22 (#6E7F99, beli 12 polucrn); natpis ≈ 18 polucrno dole.
- (M) Baner 313 × 131: figura levo ≈ 40 × 64, naslov ≈ 20 polucrno, opis ≈ 16 sivo 3 reda; razmak svih kartica 16.

### 1.11 Profil, lista (`2e17f107`)
**Svrha ekrana i šta korisnik hoće ovde:** naći jednu stvar u podešavanjima bez buke; korisnik hoće red (nalog, pomoć, privatnost) i da uđe.
**Kako kompozicija to služi:** veliko — ništa, red je jedini oblik; malo — linijska crna ikona 24, strelica; skriveno — naslov se lepi uz vrh tek pri skrolu; JEDNA radnja — nijedna (lista); izostavljeno — boja, 3D, podnaslovi, kartice u listi, linije između redova grupe.
- (M) Redovi 56, ikona 24 linijska crna na 24 od ivice, tekst ≈ 18 običan na 64 od ivice, strelica 8 × 15 siva na 28 od desne ivice.
- (M) Grupe razdvaja jedna linija 1 dp pune širine sa 16 gore i 16 dole (ne naslov); unutar grupe nema linija.
- (M) Naslov ostaje iste veličine i lepi se uz vrh; linija 1 dp ispod (na 99 dp) pojavljuje se tek pri skrolu.

## 2. Šta već imamo

**Šta već valja (ne dirati):** pilula 56 (`DiscoverySearchBar`), radijusi 12/24/28/pill, tab traka ≥ 56 sa 24 linijskim ikonama (`TabBarItem`), `Poruka`, `ProductSheet` i `ConfirmSheet` (dijalog), `FlowFooter` sa jednom zelenom, ritam `Screen`/`Section`/`ListRow`/`Surface`, centriran `StateView`, `FactRow` 28 dp 2.5D (8. okt), vrata Početne. **Izvori:** laboratorijski PNG (412 × 915, DPR 2, lažni podaci, web bez mape; crvena traka dole je LogBox laboratorije, ne naša poruka). Snimci Poruka, Obaveštenja, Moji zadaci, Dogovori i Podrška (02:52–04:43) su PRE F8b (`StateView` je od tada centriran); poredim sa kodom (`StateView.tsx:30`, ART = 96) i novim snimkom `f8b_posle_prazno-prvi` (06:08).

| # | Airbnb obrazac (dp) | Naš ekran danas (dp, tokeni) | Razlika | Predlog |
|---|---|---|---|---|
| 1 | Prvi susret: predmet 140 × 153 (Poruke) i 219 × 157 (Putovanja), naslov ≈ 22, pasus 16/21, JEDNO dugme 151 × 56 | `StateView`: kutija 96 (vidljivo ≈ 62 × 88 za tablu), `title` 21/26, `copy` 15/22 ≤ 280, zeleno `brandAction` 54 + najviše jedno tiho; razmak slika→naslov 16 | predmet ≈ 0,6–0,7 Airbnb-ovog; razmak slika→naslov 16 naspram 36–44 | P2 |
| 2 | Profil, identitet: kartica 313 × 236, lice 104, ime ≈ 32, uloga ≈ 16 | `ProfileHubPresentation`: bez kartice, lice 72 levo, ime `pageTitle` 28/33, grad + ocena; blok ≈ 80 | 72 naspram 104; levo naspram sredina | P4 |
| 3 | Dve pločice 150 × 150 sa predmetom ≈ 58 i značkom „NOVO“ | nema; redovi sa `FactArt` 32 | nema ulaznih pločica | P4 (samo kartica radnje) |
| 4 | Lista: red 56, ikona 24 linijska, tekst na 64, linija 1 dp sa 16 gore/dole | `SettingsRow`/`ListRow`: min 64 (56 bez podnaslova), `FactArt` 32 u slotu 40, tekst na 52, inset linija, odeljci razmakom 24 | naši su viši, šareniji, a ikona je predmet (doktrina FactArt) | zadržati |
| 5 | „Gde?“: kartica 337 × 368 (margina 12, unutra 24, ≈ 24), polje 56, pločica 56, korak 72, „Kada/Ko“ 329 × 60 sa razmakom 16, dno „Obriši sve“ + 141 × 48 | `DiscoverySearchPanel`/`SearchSheet`: ceo panel odozdo (uglovi 28), naslov 21 + ×, `SearchSection` red 56 sa inset linijom, polje `fieldBox` 52, `PlaceRow` 56 sa 24 dp predmetom u bunaru 32, dno „Poništi filtere“ + zeleno 54 | oblik: jedan list naspram zasebnih kartica; nema pločica 56 | P5 |
| 6 | Pilula 313 × 56, natpis centriran + lupa 20 | `DiscoverySearchBar`: `Surface float` min 56, lupa 20 + `bodyStrong`/`body` muted u jednom redu, levo, uz „···“ meni | isto (56) | zadržati |
| 7 | Čip 41 sa 3D ≈ 19, razmak 8, izabran = utonuo bunar | `DiscoveryChipRow`: min 48, `Glyph` 20 samo u „Filteri“, izabran `chipOn` (greenSoft + inset) | 48 naspram 41; bez predmeta | P6 |
| 8 | Kartica „Nastavite…“ 313 × 130, sličica 81 × 77 desno | `RasporedCard` (`HomePresentation.tsx`): `Surface record`, padding 16, strelica 20 u uglu | nema predmeta | P10 |
| 9 | Zaglavlje sekcije ≈ 20 + dugme-strelica 28 | `Section`: `heading` 18/24 + zelena reč 15/600, dodir 48 | ikona naspram reči | ne preuzimamo |
| 10 | Poruka 313 × 52, ≈ 16, predmet 22, 24 iznad tab trake | `Poruka`: min 52, radijus 28, tekst 15, zelena reč, 16 iznad trake, bez predmeta | nema predmeta; 16 naspram 24 | P9 |
| 11 | Tab traka 56, ikona 24, natpis ≈ 11 (aktivan polucrn), bez indikatora | `TabBarItem`: ≥ 56, `Glyph` 24 muted → green, `navLabel`, marker 18 × 2, linija 1 dp | gotovo isto | P11 (sitno) |
| 12 | Panel „Važi“: ≈ 28, predmet ≈ 78, naslov centriran ≈ 22–24 (28/red), dugme 312 × 48 | `ProductSheet` (28, rukohvat 40 × 4, naslov 21 levo + ×, `FlowFooter` 54); `ConfirmSheet` dijalog 24; dozvole: `FactArt` 64 (`PermissionAskHost`) | nema uvodnog oblika; predmet 64 naspram 78 | ne treba novi oblik (vidi h) |
| 13 | Okrugla dugmad zaglavlja 40 (#F2F2F2) | `ChromeIconButton` 44 bela sa ivicom 1 dp (lab) | 44 naspram 40, bela naspram siva | zadržati (dodir 48) |
| 14 | Razmaci: ivica 24, kartice 16 | `layout`: gutter 20, group 12, card 16 | 20 naspram 24; 12 naspram 16 | ne menjati (ugovor) |
| 15 | Radijusi ≈ 12 / 16–24 / 28 / pun | `sys.radius` 12 / 24 / 28 / pill | isto | — |

**(a) Prazna stanja i prvi susret.** Naša ilustracija treba da bude **144 dp (kutija; vidljivo ≈ 120–130; 40 % od 361)** na ekranima koji su ceo prazni i prvi put (Airbnb Poruke 140 = 39 %); **160** za trenutke; **96** ostaje za „filtrirano / gotovo / greška / bez veze“; **48** u sekciji (`compact`). Ritam: slika → naslov 32, naslov → rečenica 8, rečenica → dugme 32 (Airbnb 36–44 / 22 / 60); jedno zeleno dugme, najviše jedno tiho. Predmeti koje već imamo (17 PNG 1254 px + 13 vektorskih nalepnica; 144 dp je 504 px na 3,5 — oštro):

| Ekran | Predmet (`FactArt` kind) | Danas | Ima / fali |
|---|---|---|---|
| Poruke | `chat` (messages-v2, `ConversationArt`) | `chat` | ima |
| Moji zadaci | `publish` (task-launch-v2: olovka na listu sa pinom = „nov zadatak“) | `tasks` | ima |
| Moje prijave | `offers` (etiketa sa cenom) | `offers` | ima |
| Dogovori | `agreements` (karika) | `agreements` | ima |
| Obaveštenja | `bell` (zvono) | `chat` — pogrešno značenje | ima |
| Zadaci, nijedan zadatak | `map` (discover-v3) | `tasks` | ima |
| Podrška bez zahteva | `support` (slušalice) | `chat` | ima |
| Raspored (samo ako nema nijednog Dogovora) | `calendar` | rečenica | ima; prazan dan ostaje rečenica |
| Radni profil nije podešen | `WorkProfileArt` (work-kit-v1, 56) | — | ima (nije u `MATERIAL_SUBJECTS`) |
| Profil bez imena | `person` | vektor | PNG fali (opciono) |
| „Objavljeno“, ocena | `check`, `star` | vektor | PNG fali (opciono) |
| „Dogovoreno!“ | `agreements` do dolaska crteža | — | **FALI** rukovanje/pečat ili vlasnikov Lottie |
| Privatnost, bezbednost | `lock`, `shield` | vektor / Catalog27 256 px | hi-res fali (opciono) |

**(b) Profil.** Airbnb: veliki identitet + dve pločice + baner + lista sa linijskim ikonama. Naš: mali levi identitet, 4 grupe od 14 redova iste težine sa 2.5D 32. Predlog: lice 96 centrirano (KOMPOZICIJA C: „96 (profil)“), ime 28/33 centrirano, jedan red „grad · ocena“; BEZ kartice oko identiteta (nije dodirni zapis); kartica radnje „Podesi radni profil“ (zapis, `WorkProfileArt` 64) samo dok profil nije aktivan; redovi ostaju `FactArt` (naša doktrina: predmet = šta je; Glyph = šta radi); razmak između grupa 24 (naš ritam), ne linija. Pločice 150 × 150 tek kad postoji „Moja statistika / Primljene ocene“ (R30). → P4.
**(c) Pretraga „Gde?“.** Strukturno već imamo isto (odeljci, „Obriši sve“ + jedna radnja, brojač u dugmetu). Razlika je u izgledu: Airbnb svaki korak pravi kao zasebnu belu karticu na zamućenju (otvorena 337 × 368, zatvorena 60) i daje pločicu 56 redu „Nedavne pretrage“; mi imamo jedan list sa linijama. → P5 (menja već dogovoreno).
**(d) Pilula + čipovi + „nastavi gde si stao“.** Pilula u Zadacima je već 56 (dobro). Početna ostaje sa dvoja vrata (zaključano). Čipovi dobijaju predmet i 40 dp → P6. „Nastavi gde si stao“ = R18 „Nastavi nacrt“ kao RED u „Čeka te“ (POTREBE R18) — Airbnb-ovu karticu ne preuzimamo; ono što prenosimo je „kartica = jedan predmet sa desne strane“ na kartici sledećeg termina → P10.
**(e) Zaglavlje odeljka sa okruglom strelicom.** Ne preuzimamo: naši glagoli su različiti („Ceo raspored“, „Označi sve“, „Uredi mesto“); reč je jasnija od ikone (odeljak 4).
**(f) Plutajuća poruka sa malom ikonom.** Ista kapsula već postoji (`Poruka.tsx`); fali predmet 24 levo i 24 dp iznad trake → P9.
**(g) Tab traka.** Gotovo identična (≥ 56, 24, `navLabel`, aktivan zelen). Sitno: polucrn aktivan natpis i značka „Čeka te“ (R13) → P11. Arhitektura (3 korena + Poruke) je zaključana.
**(h) Panel sa velikim predmetom i jednim dugmetom.** Naš `ProductSheet` je za forme i menije, `ConfirmSheet` je centriran dijalog; „uvodni panel“ nam ne treba jer prvi susret rešava `StateView hero` (P2). Dijalog dozvola već crta predmet 64 (Airbnb panel ≈ 78); 96 je moguće, nije prioritet.

## 3. Predlog

### 3.1 Jedanaest izmena po prioritetu (uticaj / trud)
„odmah“ = kod, bez odluke vlasnika; „odluka vlasnika“ = nov crtež, pokret ili već dogovorena struktura. Nijedna ne dira ulaz V4.9, vrata ni HOME potpis; nijedna ne traži novu zavisnost.

**P1 · 2.5D se vraća na činjenice i redove — odmah · S · uticaj visok.**
- Fajlovi: `src/ui/system/FactArt.tsx` (`MARK_MAX_SIZE` 24 → 16, `factCutFor`), `src/ui/system/__tests__/fact-art.test.tsx`, `docs/implementation/design-system/ICON_SYSTEM.md` §2 (tabela „Which cut a size gets“); ≈ 50 mesta sa `FactArt` 17–24 prelaze sama.
- Mere: ≤ 16 ravna oznaka (zvezdica 16, pin uz grad 16); 17–23 vektorska nalepnica; ≥ 24 PNG kad kind ima predmet; `FactRow` 28 i `ListRow` 32 već su nalepnica.
- Primitiv: postojeći. Predmeti: 17 PNG + 13 vektorskih, ništa ne fali. Zaključano: ne (ICON_SYSTEM kaže da je ravna oznaka tim-podrazumevano, vrativo). Napomena: nalepnice 18–23 crtaju više SVG oblika (B22) — proveriti brojač.

**P2 · Prvi susret = veliki predmet i jedno dugme (`StateView` hero) — odmah · S–M · uticaj visok.**
- Fajlovi: `src/ui/system/StateView.tsx` (+ `stateRules.ts`, test), pa po ekranu samo `art`/`hero`: `messages/ConversationInboxPresentation.tsx`, `v2/MarketplacePresentation.tsx`, `v2/MyApplicationsPresentation.tsx`, `v2/AgreementCollectionPresentation.tsx`, `notifications/InboxPresentation.tsx`, `v2/discovery/DiscoveryListState.tsx`, `support/SupportInboxScreen.tsx`.
- Mere: NOVO svojstvo `hero` (samo za `cause: 'first'`): kutija 144, slika → naslov 32, naslov `title` 21/26, rečenica `copy` ≤ 280, dugme 54 (`brandAction`) + najviše jedno tiho, blok na ≈ 38 % visine (kao danas), `Arrive` jednom 800 ms. `filtered/done/error/offline` ostaju 96; `compact` 48.
- Predmeti: vidi tabelu (a) — svi postoje. Zaključano: ne; protivi se KOMPOZICIJA „art 96“ (pravilo C, T7) i `ART = 96`.

**P3 · Trenuci „Objavljeno“ i „Dogovoreno!“ — Objavljeno odmah, predmet za Dogovoreno! odluka vlasnika · M · uticaj visok.**
- Fajlovi: `ui/objava/PublishedMoment.tsx` (F4), „Dogovor je sklopljen.“ → ekran „Dogovoreno!“ u `ui/v2/ApplicationSelectionPresentation.tsx` (F3), `ui/system/SuccessMark.tsx` (F8); `Arrive.tsx` samo koristi.
- Mere: predmet 144 (do 160) BEZ sivog diska (danas lopta ≈ 50 u disku 96): predmet → 32 → naslov 21/26 → 8 → rečenica → 32 → jedno zeleno dugme 54; `Arrive` jednom; opruga bez preskoka (c ≈ 25, MOTION M-05/D3); tik uspeha na prvom dostizanju.
- Predmeti: „Objavljeno“ = vektorska nalepnica `check` 144 (postoji); „Dogovoreno!“ = `agreements` (karika, postoji) do dolaska crteža. FALI: rukovanje/pečat ili vlasnikov Lottie (V28). Zaključano: ne; D3 (preskok) je otvorena odluka.

**P4 · Profil: centriran identitet i jedna kartica radnje — identitet odmah, pločice odluka vlasnika · M · uticaj visok.**
- Fajlovi: `profile/ProfileHubPresentation.tsx`, `settings/SettingsPresentation.tsx` (F6).
- Mere: lice 96 centrirano (danas 72), značka kamere 28; ime `pageTitle` 28/33 centrirano; red „grad · 4,8 · 12 ocena“ (uz ravnu zvezdicu 16) `note` centriran; bez kartice; kad radni profil nije aktivan: jedan `Surface record` (padding 16): `WorkProfileArt` 64, `heading` „Podesi radni profil“, `note` „Dobijaš zadatke koji ti odgovaraju.“ (postojeći tekst, R20), strelica; narandžasta tačka ostaje; između grupa 24.
- Predmeti: work-kit postoji; `person` PNG fali (opciono). Zaključano: ne; protivi se KOMPOZICIJA 4.14 („lice 80 levo“). Pločice 150 × 150 — odluka vlasnika, tek posle R30.

**P5 · Pretraga: korak je kartica na zamućenju — odluka vlasnika · M · uticaj visok.**
- Fajlovi: `v2/discovery/SearchSheet.tsx`, `SearchSection.tsx`, `SearchParts.tsx`, `DiscoverySearchPanel.tsx` (F2).
- Mere: svaki odeljak = zasebna `Surface`: zatvoren `record` min 64 (oznaka `body` muted levo, izbor `bodyStrong` desno), otvoren `panel` radijus 24, unutra 20; razmak 12 (`layout.group`), margina 16 (`mapInset`); polje 56 (danas 52); „Nedavne pretrage“/mesta = red sa pločicom 56 × 56 (radijus 12, `iconWell`) + `FactArt` 32 (naša 2.5D umesto Airbnb linijske), korak 72; dno ostaje („Poništi filtere“ tiho + zeleno 54).
- Primitivi: postojeći (`Surface`, `Collapsible`); NOVO lokalno `SearchStepCard`. Predmeti: `pin`, `map`, `calendar`, `users`, `offers`, `remote` postoje. Protivi se KOMPOZICIJA 4.3, UX plan 2.19 i komentaru u `SearchSection.tsx` („no card of its own“). Pokret isti (R1 izuzetak za visinu).

**P6 · Zadaci: čipovi sa predmetom — odmah · S · uticaj srednji.**
- Fajl: `v2/discovery/DiscoveryChipRow.tsx` (F2).
- Mere: čip 40 (danas ≥ 48), dodir 48 preko `hitSlop` 4 (susedni razmak 8); predmet 24 `cut="art"`: „Na daljinu“ `remote`, „Na licu mesta“ `pin`, „Danas“ `calendar`; „Filteri · N“ ostaje `Glyph filters` 20 (kontrola); izabrani zadržava postojeći izgled.
- Primitiv: postojeći; predmeti postoje. Čipovi su filteri, ne vrste posla („nema kategorije ljudima“).

**P7 · AI razgovor: robot 128 — odmah · S · uticaj srednji.**
- Fajlovi: `aiFirst/AiAssistantArt.tsx` (`size: 24 | 88` → dodati 128), `AiConversationShell.tsx` (F4).
- Mere: 128 (≈ 35 % širine), naslov „Reci šta ti treba.“ `title`, rečenica `copy`, primeri ostaju tihi redovi (rečenice, ne kategorije), pilula-kompozitor ostaje. Predmet: `uskoci-assistant.png` (postoji). Zaključano: ne; ostaje samo opacity dolazak, bez mahanja.

**P8 · Ocena: zvezdice 2.5D — odmah · S–M · uticaj srednji.**
- Fajlovi: `reviews/AgreementReviewPresentation.tsx` (F5), `reviews/RatingsPresentation.tsx` (F6; red od 16 ostaje ravan).
- Mere: 5 × `FactArt star` 48 (izabrane pune, ostale `quiet`; 5 × 48 + 4 × 8 = 272); osoba kao lice 56 iznad; „Sačuvaj ocenu“ zeleno 54; razlog „Ocenu posle čuvanja ne možeš da menjaš.“ iznad dugmeta (postoji). Predmet: `star` vektorska nalepnica postoji; PNG fali (opciono).

**P9 · „Poruka“ sa predmetom — odmah · S · uticaj nizak–srednji.**
- Fajl: `system/Poruka.tsx` (F8). Mere: `art?: FactArtKind` — predmet 24 levo (`check` za potvrđen ishod), 12 do teksta; plutanje 24 iznad trake (danas 16); min 52 i radijus 28 ostaju; zelena reč „Vrati“ ostaje. Predmet postoji.

**P10 · Početna: kartica Rasporeda sa kalendarom — odmah · S · uticaj nizak–srednji.**
- Fajl: `home/HomePresentation.tsx:152-182` (F1). Mere: `FactArt calendar` 56 (PNG) desno u zaglavlju kartice (Airbnb 81 × 77); celu karticu dodiruješ, strelica 20 ide uz red; ostalo isto. Vrata i HOME potpis se NE diraju.

**P11 · Sitni dodiri — odmah · S · uticaj nizak.**
- (a) Tab traka: aktivni natpis `fontWeight` 600 + značka „Čeka te“ na Dogovorima (R13): `ui/system/TabBarItem.tsx` (F8); značka traži `app/(app)/_layout.tsx` (B0) — napiši u izveštaju šta. (b) Dogovor, traka koraka: urađen korak = `FactArt check` 24 umesto ravnog `Glyph`: `agreements/AgreementSteps.tsx` (F5).

### 3.2 Za svaki ekran: jedna rečenica šta ga čini lepim i jasnim
Svaki ekran: svrha → šta korisniku treba → jedna glavna stvar → šta se utišava → raspored po svrsi (kartice = zapis koji se dodiruje; redovi = lista istih stvari; odeljci = čitanje i forme; nikad kartica u kartici) → pokret (MOTION B1–B10, `sys.motion`, `Appear`/`Press`/`haptics`; činjenice se nikad ne animiraju) → jedan vizuelni potez.

**1. Početna** — lepa i jasna kad su dvoja vrata jedino veliko, a sve ostalo tihi redovi (`home/HomePresentation.tsx`).
- Čemu služi: razdvaja nameru (tražim pomoć / uskačem) i pokazuje šta danas čeka tvoju odluku. Šta korisniku treba ovde: da jednim dodirom počne zbog čega je došao, ili da vidi da ništa ne gori. Jedna glavna stvar: dvoja vrata (zaključana, ≈ 88 dp); zelenog dugmeta nema.
- Šta se utišava ili skriva: „Kako radi“ samo novom nalogu (uz „Sakrij“); „Raspored“ samo uz termin; „Čeka te“ prazno = jedan sivi red; „Moji zadaci / Moje prijave“ su dva tiha reda.
- Raspored po svrsi: vrata = kartice (dodirni zapisi); „Čeka te“ = redovi; sledeći termin = jedna kartica; „Moji…“ = redovi. Pravilo ispoštovano; kartica „Nastavite…“ ne treba (R18 je red; slažem se sa POTREBE).
- Pokret: u mirovanju ništa; prvi redovi posle skeleta ulaze jednom (`Appear` 240 + 40, ≤ 6); pritisak 0,985 + `select`; osvežavanje nativno (B1).
- Vizuelni potez: P10 (kalendar 56 na kartici termina); vrata se ne diraju.

**2. Zadaci, mapa** — lepa i jasna kad je mapa jedino veliko, a pilula i čipovi lebde tiho (`v2/DiscoveryPresentation.tsx`, `discovery/DiscoverySearchBar.tsx`, `DiscoveryChipRow.tsx`, `PricePill.tsx`).
- Čemu služi: pokazuje gde su otvoreni zadaci. Šta korisniku treba ovde: u jednom pogledu vidi šta je blizu i koliko nudi. Jedna glavna stvar: pin → kartica (zelena radnja je na detalju).
- Šta se utišava ili skriva: kucanje (pilula umesto polja), uslovi iza „Filteri · N“, spisak ispod mape, tačna lokacija (crta se približno), zum i „U blizini“ tiho.
- Raspored po svrsi: pin = mali dodirni zapis (kapsula 40 sa znakom brenda + iznosom), kartica pina = `record`, pilula i čipovi = `float` kontrole. Krši: ≥ 4 lebdeća objekta u mirovanju (KOMPOZICIJA 4.2: ≤ 3).
- Pokret: kamera 360 `easeOut`; izabrani pin 1,06× i halo odjednom (bitmapa); kartica i spisak `sheetSpring`; zum 180; ništa se ne kreće samo (B2).
- Vizuelni potez: P6. Pastelne pločice po vrsti NE preuzimamo („nema kategorije ljudima“); pin ostaje kapsula sa iznosom.

**3. Zadaci, lista** — lepa i jasna kad je svaka kartica jedna ideja: naslov, iznos, mesto, vreme, osoba (`v2/TaskCard.tsx`, `discovery/TaskRecordBody.tsx`, `DiscoveryListSheet.tsx`).
- Čemu služi: da uporediš zadatke. Šta korisniku treba ovde: naslov, iznos, mesto, vreme, ko objavljuje — bez otvaranja. Jedna glavna stvar: dodir kartice.
- Šta se utišava ili skriva: opis, kategorija (ne prikazuje se ljudima), tuđe prijave, uslovi osim jednog „važnog“ reda, pouzdanost dok vlasnik ne uključi.
- Raspored po svrsi: kartice (`Surface record`) jer se dodiruju; lice i ocena su red UNUTAR kartice. Krši: kartica u laboratoriji ≈ 225 dp sa tri reda činjenica + lice (KOMPOZICIJA 4.2: ≤ 220 pri 1,15 i dva `FactRow`, mesto i vreme).
- Pokret: nova kartica `Appear` (samo nov id); pritisak 0,985; spisak `sheetSpring`; iznos i „0/2“ nikad.
- Vizuelni potez: P1 (2.5D 28 na činjenicama, ravna zvezdica 16); najviše tri reda činjenica; iznos u naslovnom redu.

**4. Zadaci, detalj** — lepa i jasna kad se odluka čita odozgo nadole bez linija (`v2/PublicNeedPresentation.tsx`, `v2/detail/TaskDecision.tsx`).
- Čemu služi: da odlučiš da li da se javiš. Šta korisniku treba ovde: iznos, kada, gde (približno), šta tačno, ko, uslovi. Jedna glavna stvar: „Sastavi prijavu“ (zeleno u podnožju; siva sa razlogom kad ne može).
- Šta se utišava ili skriva: tačna adresa (tek u Dogovoru), tuđe prijave, kategorija; pitanja u `Disclosure`; fotografije samo ako ih ima (galerija je već prva).
- Raspored po svrsi: odeljci + `FactRow detail`; „Objavio“ = jedan dodirni red (lice 56); kartice ne trebaju. Pravilno (lab `f2_posle_detalj`).
- Pokret: ulaz 240 `easeOut`; fotografije se uklapaju 180; iznos i činjenice ne; „Sastavi prijavu“ 0,97.
- Vizuelni potez: bez nove kompozicije; P1 daje 2.5D i sitnim oznakama u „Važno“ (alat = `tool`, uslov = `info`).

**5. Zadaci, pretraga** — lepa i jasna kad je jedan korak otvoren, a ostali tihi redovi (`discovery/DiscoverySearchPanel.tsx`, `SearchSheet.tsx`, `SearchSection.tsx`, `SearchParts.tsx`).
- Čemu služi: da suzi spisak po mestu, vremenu i uslovima. Šta korisniku treba ovde: da otkuca/izabere mesto i vidi koliko zadataka dobija. Jedna glavna stvar: zeleno „Prikaži N zadataka“ (dole, uvek vidljivo).
- Šta se utišava ili skriva: otvoren je jedan odeljak, ostali su zatvoreni sa izborom desno; „Za mene“ kad server ima; brojač 300 ms posle poslednje promene.
- Raspored po svrsi: zatvoren odeljak = dodirni red; otvoren = `panel` sa poljem i redovima. Danas jedan list sa inset linijama (4.3) — ne krši pravilo, ali nema dubinu Airbnb-ovog niza kartica.
- Pokret: pozadina zamućena + panel `sheetSpring` ≈ 300 (zatvaranje 170–180); izbor otvara sledeći (240); visina na JS niti je rizik (M-08).
- Vizuelni potez: P5. Protivi se KOMPOZICIJA 4.3 i UX plan 2.19.

**6. Moji zadaci** — lepa i jasna kad kartica kaže samo stanje i sledeći korak (`v2/MarketplacePresentation.tsx`, `v2/OwnTaskCard.tsx`).
- Čemu služi: da pratiš objavljene zadatke. Šta korisniku treba ovde: koji ima prijave za izbor, koji čeka, koji je gotov. Jedna glavna stvar: dodir kartice; „Imaš 3 prijave. Uporedi ih i izaberi“ je jedina „noga“; prazno: „Objavi prvi zadatak“.
- Šta se utišava ili skriva: istorija i nacrti u tabovima; filteri iza „Filteri“; broj samo uz „Aktivni“.
- Raspored po svrsi: kartice (zapis) — pravilno; noga je jedina dozvoljena podela. Krši: ≈ 200+ dp po kartici (cilj ≤ 200).
- Pokret: `Appear` novi id; pritisak 0,985; indikator segmenta 180; promena stanja čipa u mestu.
- Vizuelni potez: P2 (prazno: `publish` 144 + „Objavi prvi zadatak“ + tiho „Pogledaj zadatke“).

**7. Prijave (Moje prijave i forma Prijava)** — lepa i jasna kad lista kaže gde je prijava, a forma traži samo ono što fali (`v2/MyApplicationsPresentation.tsx`, `ApplicationComposerPresentation.tsx`).
- Čemu služi: lista — gde je svaka prijava; forma — slanje ponude. Šta korisniku treba ovde: stanje i sledeći korak; u formi iznos, ljudi, termin, poruka. Jedna glavna stvar: lista — dodir kartice; forma — „Pregledaj prijavu“ (siva sa razlogom dok nema iznosa).
- Šta se utišava ili skriva: „Završene“ pod filterom; poruka poslednja i neobavezna; „Ovo šalješ“ tek posle.
- Raspored po svrsi: lista = kartice (`PrijavaCard`); forma = čiste sekcije i polja bez kartica. Pravilno.
- Pokret: `Appear`; stepper `select`; slanje: kvačica u dugmetu, pa `SuccessMark`.
- Vizuelni potez: P2 (prazno: `offers` 144 + „Istraži zadatke“); polje „Iznos“ 72 već ima velike cifre.

**8. Kandidati (izbor ljudi)** — lepa i jasna kad se osobe porede istim karticama (`v2/ApplicationSelectionPresentation.tsx`, `CandidateFace.tsx`).
- Čemu služi: da uporediš prijave i izabereš osobu. Šta korisniku treba ovde: ko je, ocena, koliko traži, kada može, šta nosi — za 5 sekundi. Jedna glavna stvar: „Izaberi“ u otvorenoj ponudi (zeleno).
- Šta se utišava ili skriva: ponuda u panelu; „Uporedi“ u traci; poruka 2 reda; alat/vozilo jedan red (R24).
- Raspored po svrsi: kandidat = kartica (lice 56) — pravilno. Krši: `band` i `offerTerms` sa linijama u ponudi (KOMPOZICIJA 4.7: `Section`-i).
- Pokret: ulaz izbora `FadeIn` (M-01b); posle izbora ceo ekran „Dogovoreno!“ ≈ 1,2 s pa mir (UX 2.9); pritisak 0,985.
- Vizuelni potez: P3 („Dogovoreno!“, `agreements` 144 do dolaska crteža); kartica ≤ 4 reda.

**9. Objava, razgovor (AI)** — lepa i jasna kad robot krupno kaže „Reci šta ti treba.“ i nema obrasca (`aiFirst/AiConversationShell.tsx`, `AiAssistantArt.tsx`, `v2/IntakePresentation.tsx`).
- Čemu služi: da opišeš zadatak svojim rečima (glas ili tekst). Šta korisniku treba ovde: da kaže šta mu treba bez obrasca i vidi da je razumeo. Jedna glavna stvar: pilula-kompozitor; kad je spremno „Pregledaj i objavi“ (zeleno).
- Šta se utišava ili skriva: tri primera su tihi redovi (rečenice, ne kategorije); „O govornom unosu i privatnosti“ sivi red; kartica nacrta tek kad ima čega.
- Raspored po svrsi: mehurovi + `panel` nacrta (ne dodiruje se); primeri = redovi. Pravilno.
- Pokret: nove poruke `FadeInDown` (M-01b), tačkice 520, sjaj pilule po glasu; robot samo opacity pri otvaranju.
- Vizuelni potez: P7 (robot 128).

**10. Objava, pregled** — lepa i jasna kad je ono što vidiš pre objave ono što drugi vide (`objava/ReviewPresentation.tsx`, `app/(app)/pregled-zadatka.tsx`).
- Čemu služi: provera pre objave. Šta korisniku treba ovde: iznos, vreme, mesto (javno / privatno), šta još fali. Jedna glavna stvar: „Objavi zadatak“ (siva sa razlogom dok nešto fali); „Sačuvaj nacrt“ tiho.
- Šta se utišava ili skriva: privatna adresa u „Privatni podaci“ ispod; mapa iza „Otvori mapu“; „Još treba“ samo kad fali.
- Raspored po svrsi: kartica „kako ga vide drugi“ je `panel` (ne dodiruje se, bez senke); „Mesto“ i „Privatni podaci“ odeljci. Pravilno.
- Pokret: samo prelaz 240 i `Poruka`; „Objavljujem…“ spiner samo u dugmetu; činjenice ne.
- Vizuelni potez: isti redosled i oblik činjenica kao kartica u listi (UX 2.11), 2.5D 28 (P1).

**11. Objavljeno (trenutak)** — lepo i jasno kad je jedan predmet, jedna rečenica i jedno dugme (`objava/PublishedMoment.tsx`, `system/SuccessMark.tsx`).
- Čemu služi: potvrda da je zadatak objavljen. Šta korisniku treba ovde: da zna da je objavljeno i gde će videti prijave (spisak i zvonce). Jedna glavna stvar: „Otvori zadatak“.
- Šta se utišava ili skriva: sve ostalo (prazan ekran, bez trake i drugog dugmeta).
- Raspored po svrsi: nijedna kartica; centrirana kolona. Pravilno.
- Pokret: `SuccessMark` spring (preskok 19 %, D3) + tik; 1,2–1,5 s pa mir; smanjen pokret: skok + tik.
- Vizuelni potez: P3 (predmet 144, `Arrive`, bez preskoka). Protivi se UX 2.9 („SuccessMark 64“).

**12. Dogovori, lista** — lepa i jasna kad jedino narandžasta „noga“ govori šta čeka tebe (`v2/AgreementCollectionPresentation.tsx`, `agreements/AgreementListCard.tsx`).
- Čemu služi: svi dogovoreni zadaci i šta čeka tebe. Šta korisniku treba ovde: sa kim, kada, gde, koliko i da li treba moja radnja. Jedna glavna stvar: „noga“ koja čeka tebe; inače dodir kartice.
- Šta se utišava ili skriva: istorija iza taba; Raspored iza ikone kalendara; čip „Čeka tvoju potvrdu“ samo kad ima.
- Raspored po svrsi: kartice (zapis) — pravilno; lice 40 + naslov + `note` + kada · gde + čip + iznos; noga je jedina podela.
- Pokret: `Appear` novi id; pritisak 0,985; segment 180.
- Vizuelni potez: P2 (prazno: `agreements` 144 + „Pogledaj zadatke“ zeleno + „Objavi zadatak“ tiho).

**13. Dogovor, detalj** — lepa i jasna kad uvek znaš čiji je sledeći potez (`app/dogovor/[id].tsx`, `agreements/AgreementWorkspace.tsx`, `AgreementSteps.tsx`).
- Čemu služi: vodi dogovor od „Dogovoreno“ do „Ocena“. Šta korisniku treba ovde: čiji je sledeći potez, uslovi, kontakt i mesto kad zatreba. Jedna glavna stvar: jedno zeleno dugme za sledeći korak ili jedna siva rečenica.
- Šta se utišava ili skriva: retke radnje u „Izmene i otkazivanje“; bezbednost; tok u `Disclosure`; broj i adresa tek kad se podele.
- Raspored po svrsi: odeljci + `KeyValueRow`; topla `note` za „čeka tvoju potvrdu“; koraci kao traka; kontakt = `ListRow`. Pravilno, bez kartica.
- Pokret: tačka koraka 0,6 → 1 samo kad se stanje promeni dok gledaš (M-09); prelaz 240; Pregled ↔ Poruke bez prelaza.
- Vizuelni potez: P11b (urađen korak = 2.5D `check` 24).

**14. Dogovor, razgovor** — lepa i jasna kad se ništa ne pomera samo od sebe (`v2/AgreementThreadPresentation.tsx`, `ui/AgreementChat.tsx`).
- Čemu služi: dogovor sa drugom osobom. Šta korisniku treba ovde: da piše, šalje glas i slike i vidi šta je stiglo. Jedna glavna stvar: polje za poruku / „Pošalji“.
- Šta se utišava ili skriva: nema „viđeno“ (uspavano); greške slanja samo uz svoju poruku („Nije poslato“ + „Pošalji ponovo“).
- Raspored po svrsi: mehurovi (nisu kartice) + `float` composer. Pravilno.
- Pokret: ništa (zaključano testom `conversation-has-no-motion`); haptika na slanje i mikrofon (M-04).
- Vizuelni potez: nema promene izgleda; razgovor bez poruka: `StateView compact` sa `chat` 96.

**15. Ocena** — lepa i jasna kad je jedan krupan potez: zvezdice (`reviews/AgreementReviewPresentation.tsx`, `RatingsPresentation.tsx`).
- Čemu služi: da pošteno oceniš saradnju. Šta korisniku treba ovde: zvezdice jednim dodirom, po želji oznake i komentar. Jedna glavna stvar: „Sačuvaj ocenu“ (siva sa razlogom dok nema zvezdica).
- Šta se utišava ili skriva: oznake neobavezne (do 3); komentar poslednji; „Ocenu posle čuvanja ne možeš da menjaš.“ kao siv razlog.
- Raspored po svrsi: čista forma (odeljci), zvezdice su kontrola, oznake čipovi (≤ 7); bez kartica. Pravilno.
- Pokret: zvezdica puni 0,8 → 1 + `select` 180; „sačuvano“ `SuccessMark`; smanjen pokret: odmah.
- Vizuelni potez: P8.

**16. Raspored** — lepa i jasna kad nedelja stoji u traci, a dan je lista termina (`calendar/AgendaScreen.tsx`, `WeekStrip.tsx`, `AgendaRow.tsx`).
- Čemu služi: šta je zakazano po danima. Šta korisniku treba ovde: danas / sutra / ove nedelje i šta nema tačan termin. Jedna glavna stvar: izbor dana (radnje nema, pregled je).
- Šta se utišava ili skriva: prazan dan = jedna rečenica (ne hero); filter čipovi; mesec iza „5–11. okt“; „Moja dostupnost“ i „Arhiva“ tihi redovi.
- Raspored po svrsi: dan = lista kartica (`AgendaRow` = zapis koji otvara Dogovor) — pravilno; traka nedelje = kontrola; veze na dnu = redovi.
- Pokret: promena dana i nedelje odmah (namerno statično; M-10 opcija); mesec u `ProductSheet`.
- Vizuelni potez: bez novog izgleda (KOMPOZICIJA 4.10: bez šine i isprekidane ivice je dovoljno); samo kad nema nijednog Dogovora: `StateView hero` sa `calendar`.

**17. Poruke** — lepa i jasna kad je lista redova sa licima i jednom zelenom tačkom za novo (`messages/ConversationInboxPresentation.tsx`, `app/(app)/poruke.tsx`).
- Čemu služi: da nađeš razgovor i vidiš šta je novo. Šta korisniku treba ovde: ko je pisao, o kom zadatku, kad; nepročitano. Jedna glavna stvar: dodir reda → razgovor u tom Dogovoru.
- Šta se utišava ili skriva: završeni pod čipom (R17); pregled poslednje poruke 1 red; brava umesto reči „zatvoren“.
- Raspored po svrsi: redovi iste vrste (lice 56 + ime + pečat) sa inset linijom — Airbnb-ov obrazac liste poruka; kartice ne trebaju.
- Pokret: samo pritisak 0,985 (danas nema `Appear`; predlog: nov razgovor ulazi 240 `easeOut`, samo nov id, kao u Obaveštenjima).
- Vizuelni potez: P2 (prazno: `chat` 144 + „Otvori Dogovore“). Veliki naslov „Poruke“ NE preuzimamo.

**18. Obaveštenja** — lepa i jasna kad red kaže šta se desilo i kuda vodi (`notifications/InboxPresentation.tsx`).
- Čemu služi: šta se desilo i kuda to vodi. Šta korisniku treba ovde: šta, o kom zadatku, i jedan dodir do mesta. Jedna glavna stvar: dodir reda; „Označi sve“ u zaglavlju grupe.
- Šta se utišava ili skriva: filteri „Sve | Moji zadaci | Moje prijave“; „kuda vodi“ u `meta`; pročitano bez zelene tačke.
- Raspored po svrsi: redovi grupisani po danu — pravilno.
- Pokret: prevuci-za-pročitano (M-18), `Appear` novi id; „Označi sve“ spiner u dugmetu.
- Vizuelni potez: P2 (prazno: `bell` 144, danas crta `chat`; + „Podesi obaveštenja“).

**19. Profil (hub)** — lepa i jasna kad prvo vidiš sebe, pa jednu radnju, pa mirnu listu (`profile/ProfileHubPresentation.tsx`, `settings/SettingsPresentation.tsx`).
- Čemu služi: kako te drugi vide i put do postavki. Šta korisniku treba ovde: potvrda identiteta; ulaz u radni profil, područje, dostupnost; nalog i pomoć. Jedna glavna stvar: dok profil nije aktivan — „Podesi radni profil“ (kartica sa narandžastom tačkom); inače nema.
- Šta se utišava ili skriva: „Privatnost“ u mirnoj grupi (quiet); „Odjavi se“ crven red na dnu; verzija sitno.
- Raspored po svrsi: identitet = odeljak (nije dodirni zapis, bez kartice); radnja = jedan zapis; grupe = redovi. Krši: 14 redova iste težine bez vodiča.
- Pokret: ništa osim pritiska 0,985; foto je `Press`.
- Vizuelni potez: P4. Protivi se KOMPOZICIJA 4.14.

**20. Profil, podekrani** (Radni profil, Područje rada, Dostupnost, Obaveštenja, Privatnost, Podrška, Izvoz, Pravila, O aplikaciji, Lozinka, Prijavi grešku) — lepi i jasni kad svaki menja jednu stvar i kaže da je sačuvano (`workerProfile/*`, `settings/*`, `support/*`, `privacy/*`, `legal/*`).
- Čemu služi: svaki menja jednu postavku ili pokazuje jedan dokument. Šta korisniku treba ovde: stanje, jedna izmena, potvrda. Jedna glavna stvar: „Sačuvaj izmene“ (zeleno, podnožje) ili „Novi zahtev“; info ekrani nemaju radnju.
- Šta se utišava ili skriva: napredno u `Disclosure` (Rokovi čuvanja), retke radnje u „···“, pravni tekst iza reda.
- Raspored po svrsi: forme = odeljci + polja; stanja = `ListRow`; info = tekst bez slike i strelice (KOMPOZICIJA 4.15); kartica samo „Ispričaj čime se baviš“ (dodirni zapis). Krši: Privatnost nema nijedan vizuelni oslonac.
- Pokret: ništa osim `Press`; „Sačuvano“ = `Poruka` (potvrđeno serverom → tik).
- Vizuelni potez: P2 (Podrška bez zahteva: `support` 144) i P1; kartica „Ispričaj čime se baviš“ (`chat` 56) ostaje.

**21. Prijava i registracija** — lepa i jasna kad je jedna kratka forma i jedno zeleno dugme (`auth/AuthPresentation.tsx`, `AuthFormStep.tsx`; ulaz V4.9 zaključan).
- Čemu služi: da uđeš u nalog. Šta korisniku treba ovde: brzo email i lozinka, bez grešaka u formi. Jedna glavna stvar: „Prijavi se“ (zeleno iznad tastature).
- Šta se utišava ili skriva: „Zaboravljena lozinka?“ tekst; „Napravi nalog“ je segment; objašnjenje o načinu prijave sivo.
- Raspored po svrsi: čista forma u panelu. Pravilno.
- Pokret: panel `sheetSpring`; podnožje prati tastaturu; greške bez treskanja.
- Vizuelni potez: nijedan novi (ulaz i kompozicija zaključani).

### 3.3 Gde se ovaj dokument protivi ranijim
1. **KOMPOZICIJA pravilo C i T7, `StateView.tsx:30` (art 96 za prazno stanje)** → 144 samo za prvi susret; 96 ostaje za ostala stanja.
2. **KOMPOZICIJA 4.14 (identitet bez kartice, lice 80 levo; kod 72)** → centriran 96, i dalje bez kartice.
3. **KOMPOZICIJA 4.3, UX plan 2.19, komentar u `SearchSection.tsx`** („odeljak = red liste, bez kartice“) → kartica po koraku (odluka vlasnika).
4. **ICON_SYSTEM §2–3 („24 i manje = ravna oznaka“, tim-podrazumevano, vrativo)** → vlasnik traži 2.5D natrag: prag 16.
5. **UX plan 2.9 / MOTION B8, M-05** (Objavljeno `SuccessMark` 64; „Dogovoreno!“ 96; preskok 19 %) → predmet 144, `Arrive`, opruga bez preskoka (D3).
6. **KOMPOZICIJA C / UX plan 2.20b („FactArt na 24 i 32“)** → činjenica 28 (`FactRow`), nalepnica od 17 dp.
7. **UX plan 2.1 (dozvole: predmet 48; kod već 64)** → ostaje 64; 96 nije prioritet.
8. **KOMPOZICIJA T1 (koren bez imena ekrana) i vlasnikovo „bez orijentacionog teksta“** → NE preuzimamo veliki naslov korena (Airbnb „Poruke“, „Profil“).
9. **POTREBE R18 („Nastavi nacrt“ kao red)** → potvrđujem, ne preuzimam Airbnb karticu „Nastavite…“. MOTION C7 („ilustracija 56 u zdencu 80“) je već prevaziđeno F8b; ne vraćati.

## 4. Čemu se NE povodimo
1. **Fotografije domova, srca, „Gostima omiljeno“:** zadaci nemaju obaveznu fotografiju; „Sačuvaj“ (zvezdica) je odložen (UX 2.15, server); značka bez činjenice bi bila izmišljena.
2. **Valuta i „po noćenju“:** pišemo RSD; nepoznata cena nikad ne liči na iznos.
3. **Crveno-roze radnja sa gradijentom i crno dugme „Važi“:** naša glavna radnja je ZELENA #00845A, ravna (kontrast 4,72 sa belim); narandžasta samo akcenat; crno ostaje za kontrole koje nisu glavna radnja (UX 2.18).
4. **Topla hartija panela (#F3F2ED) i sivi gradijent iza pilule (#E3E3E3 → bela):** AGENTS 3.6.5 — bele površine, neutralni bunari.
5. **Veliki naslov korena („Poruke“, „Profil“ ≈ 32):** naš koren ima znak i zvonce; ime ekrana se ne crta (T1; „bez gde-si teksta“); donja traka kaže gde si.
6. **Kategorije kao 3D ikone (Domovi / Doživljaji / Usluge, pastelni pinovi po vrsti):** „nema kategorije ljudima“; naši čipovi su filteri (Danas, Na daljinu), ne vrste posla.
7. **Dugme-strelica bez reči u zaglavlju odeljka:** naši glagoli se razlikuju („Ceo raspored“, „Označi sve“, „Uredi mesto“); reč je jasnija; najviše „reč + strelica 16“.
8. **„NOVO“ značke i promo kartice („Postanite domaćin“):** marketing; naš „Podesi radni profil“ je funkcija (R20) i vidi se samo dok je potreban.
9. **Pet tabova, Putovanja, Liste želja:** arhitektura korena je ZAKLJUČANA (Početna, Zadaci, Dogovori + Poruke).
10. **Animirano zamućenje i paralaksa:** MOTION A1/S5; pozadina pretrage ostaje statično zamućena ili zatamnjena.
11. **Pretraga kao glavni element Početne:** naša Početna ima dvoja vrata (zaključano); pretraga živi u Zadacima.
12. **Objašnjenje cene u panelu („jedna cena sa naknadama“):** USKOČI ne prima novac u V1 (R03); rečenica o plaćanju je tekst vlasnika (R07), ne dizajn.

## 5. Redosled rada

### 5.1 Četiri agenta po fajlovima (porodice iz `FAMILIES.md`, jedan pisac po fajlu)

| Agent | Porodice | Fajlovi | Predlozi | Zavisi od |
|---|---|---|---|---|
| A | F8 sistem | `src/ui/system/**` (osim B0: `tokens.ts` motion, `Appear`, `Arrive`, `haptics`, `motion.ts`), `src/ui/product/**` | P1, API za P2 (`StateView hero`), P9, `SuccessMark` bez preskoka za P3, P11a | prvi: predaje `hero`, prag nalepnice i `Poruka art` u prvih 1–2 sata |
| B | F1 + F3 | `home/**`, `notifications/**`, `messages/**`, `needs/**`, `v2/MarketplacePresentation`, `MyApplicationsPresentation`, `ApplicationSelectionPresentation`, `CandidateFace` | P2 (Poruke, Obaveštenja, Moji zadaci, Moje prijave), P3 („Dogovoreno!“), P10 | A |
| C | F2 + F4 | `v2/discovery/**`, `v2/DiscoveryPresentation`, `objava/**`, `aiFirst/**`, `v2/IntakePresentation` | P5, P6, P7, P3 („Objavljeno“), P2 (Zadaci bez rezultata) | A |
| D | F5 + F6 + F7 | `agreements/**`, `calendar/**`, `v2/AgreementCollectionPresentation`, `reviews/**`, `profile/**`, `settings/**`, `support/**`, `permissions/**` | P4, P8, P11b, P2 (Dogovori, Podrška) | A |

Redosled: talas 1 = agent A (API + testovi + galerijska scena `dizajn-sistem`); talas 2 = B, C, D paralelno. Provera po ekranu: pre/posle snimci u laboratoriji (font 1,15 i 1,3), ciljani `jest --maxWorkers=2`, jedan `tsc` na kraju; ratchet testovi (`one-token-source`, `glyph-import-guard`, `surface-kinds-ratchet`) ostaju zeleni. `app/(app)/_layout.tsx` je B0: značku za P11a niko ne piše, već se traži u izveštaju. `reviews/AgreementReviewPresentation.tsx` je F5, ostatak `reviews/**` F6: agent D drži oba.

### 5.2 Šta traži vlasnika
- **Novi crteži:** (1) predmet za „Dogovoreno!“ (rukovanje ili pečat) ili njegov Lottie (V28); (2) zvezda kao PNG (opciono, vektor važi); (3) osoba kao PNG (opciono); (4) „dioram“ prvog susreta kao Airbnb Putovanja, složen od naših predmeta: karta + tabla + kutija sa alatom + kombi (opciono); (5) štit i brava u visokoj rezoluciji (Catalog27 su 256 px; opciono).
- **Odluke:** (a) prag nalepnice 16 (P1; vlasnik je već rekao „vrati 2.5D“, treba mu samo potvrda praga); (b) predmet 144/160 u prvom susretu (P2; menja KOMPOZICIJA „96“); (c) pretraga kao niz kartica (P5); (d) Profil: centriran identitet i da li pločice 150 × 150 (do R30 se odlažu); (e) opruga bez preskoka u trenucima (MOTION D3).
- Nova zavisnost: nijedna. Server: ništa.

### 5.3 Ograničenja ovog nalaza
Airbnb: 11 mirnih slika, bez pokreta i trajanja; „sp“ su približni (font telefona), radijusi ±3 dp. Naši snimci: laboratorija 412 × 915 sa lažnim podacima, bez mape (pinovi i mapa nisu viđeni); Poruke, Obaveštenja, Moji zadaci, Dogovori i Podrška su iz perioda pre F8b. Kod čitan u radnom stablu sa nekomitovanim izmenama drugih agenata (linije se pomeraju). Ništa nije proveravano na telefonu i nijedna tvrdnja o pokretu nije mereno.

## 6. Načela jasnoće (za svaki ekran)
1. **Jedna svrha, jedna radnja.** Ekran odgovara na jedno pitanje i ima jednu zelenu radnju (podnožje ili sredina); sve ostalo je bela ili zelena reč; kad radnja ne može, siva sa razlogom iznad. Provera: ≤ 1 `brandAction` po ekranu.
2. **Prvi susret = veliki predmet i jedno dugme.** Ekran bez sadržaja: predmet 144, naslov, jedna rečenica, jedno zeleno dugme (+ najviše jedno tiho); bez uputstva i bez drugog crteža.
3. **Oblik prati svrhu.** Kartica je zapis koji se dodiruje; lista istih stvari su redovi; čitanje i forme su odeljci; nikad kartica u kartici (`Surface` upozorava).
4. **Jedna ideja po kartici.** Naslov + do tri činjenice + osoba; ostalo u detalj; zapis zadatka ≤ 220 dp, Dogovor ≤ 160 pri 1,15.
5. **Veličina prati važnost.** Predmet 144 samo za prvi susret i trenutak; 28–32 za činjenice i redove; 16 ravna oznaka u liniji teksta; najviše 5 uloga teksta po ekranu.
6. **Postepeno otkrivanje.** Vidi se ono što treba sada; ostalo iza „···“, `Disclosure`, taba ili sledećeg koraka; najviše 3 jednaka izbora (`Segmented`), 4–7 čipovi, više od 7 lista ili pretraga; u panelu jedan otvoren odeljak.
7. **Predmet znači vrstu, lice znači osobu.** U listi iste vrste ne ponavljamo isti predmet (tamo je lice ili inicijali); isti predmet ima isto značenje na svakom ekranu (`FACT_MEANING`).
8. **Pokret objašnjava, ne ukrašava.** Pomera se samo kontejner koji stiže ili menja stanje (red, panel, trenutak); iznos, vreme, broj i reč stanja nikad; haptika samo za ishod; pri smanjenom pokretu ista informacija bez kretanja.
