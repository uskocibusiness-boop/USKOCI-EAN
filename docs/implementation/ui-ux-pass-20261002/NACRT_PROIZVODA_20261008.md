# Nacrt proizvoda USKOČI — svaki ekran, ulaz, filter, komanda i tok (8. 10. 2026)

> **Posle predaje: nova revizija za pregled, ne implementacija.** [Audit i specifikacija svih 62 površine](#revizija-20261008) · [58 skica ekrana/stanja](PREDLOG_EKRANA_20261008.html). Raniji tekst ispod ostaje istorija odobrenog pravca. Nova kompozicija, izbor 3/4 taba i pretraga A/B/C čekaju vlasnikov pregled. App, server i uređaji nisu menjani.

**Šta je ovo.** Odgovor na vlasnikovo pitanje (8. 10.): „da li si osmislio kako će svi ti ekrani da izgledaju… ne samo boje i font, nego i sama kompozicija, nešto doda, oduzme, napravi drugačije, drugačiji ulaz, prikaz, filter… neki filter koji je falio ili je bio nepotreban, ulaz ili komanda uvezana kroz tokove… kao pravi produkt arhitekta kompletnog proizvoda“. Ovo je PREDLOG arhitekture celog proizvoda; vlasnik ga gleda kao skice na platnu „Nacrt proizvoda USKOČI“ (https://claude.ai/artifact/6fzbWbjPoRbhKP19d9edX1) i kaže da/ne po ekranu. Ništa ovde nije odobreno samim zapisom. Pravila J1–J15 i dijagnoza: `ANALIZA_EKRANA_TELEFON_20261008.md`. Vlasnikovi izbori sa table (`IZBOR_VLASNIKA_20261008.md`) i zaključani delovi (ulaz V4.9, dve velike pločice Početne) ostaju.

**Status (8. 10. 2026):** vlasnik je napisao „Odobravam“ (doslovno) posle objave platna, a odmah zatim „Ali ja ne vidim same ekrane… vidim samo skicu celog app“ — dakle odobrenje je dato pre nego što je video skice pojedinačnih ekrana. Posle toga su svi ekrani stavljeni na jednu površinu platna i objavljeni kao galerija za telefon (https://claude.ai/artifact/VLiAKoN5NxvfXqzETGQq12). Talasi rade po nacrtu; svaka njegova kasnija primedba po ekranu ima prednost.

**Istina podataka.** Sve što se dodaje koristi podatak koji već postoji. Gde treba server, piše **[server]**; gde treba provera, **[proveriti]**. Ništa izmišljeno se ne crta.

## 0. Arhitektura u jednoj slici

- **Donja navigacija (4):** Početna · Zadaci · Dogovori · Poruke. Profil = lice gore desno; Obaveštenja = zvono gore desno (na Početnoj, Dogovorima i Porukama). Na Zadacima je navigacija sakrivena dok je lista dole (vlasnikova odluka).
- **Svaka stvar ima jedan dom (J1):** lični podaci (ime, fotografija, grad) → Lični podaci; šta radim/gde/kada/oprema → Radni profil; dogovoreni termini → Raspored (ulaz samo iz Dogovora); objavljeni zadaci → Moji zadaci; poslate ponude → Moje prijave; razgovori → Poruke; istorija događaja → Obaveštenja; podešavanja obaveštenja → jedan ekran.
- **Gde stoji komanda (J15):** glavna radnja = jedino zeleno dugme na ekranu; česte sporedne = vidljivi redovi/dugmad; objašnjenja = ⓘ; izbor sa više opcija ili potvrda = list odozdo; unos jednog podatka = list sa jednim poljem; pretraga, fotografije, velika mapa = ceo ekran; retko (podeli, prijavi zadatak) = „⋯“. Izmena i otkazivanje nikad samo u „⋯“.
- **Posle svakog koraka jasno odredište:** objava → moj zadatak; poslata ponuda → Moje prijave sa novom označenom; „Dogovoreno!“ → Dogovor sa „Predloži termin“; ocena → Dogovori (Istorija) sa „Ocenjeno“; obaveštenje → tačan ekran i tačan zadatak.

## 1. Tokovi

- **T1 Tražim pomoć:** Početna „Objavi zadatak“ → razgovor sa asistentom → Pregled → „Objavi zadatak“ → Moj zadatak (čeka) → obaveštenje „Nova prijava · *naslov*“ → Prijave → „Izaberi“ (potvrda u listu) → „Dogovoreno!“ → Dogovor: „Predloži termin“ → Poruke → radnik: „Zadatak je gotov“ → „Potvrdi završetak“ → Ocena.
- **T2 Uskačem:** Početna „Uskoči i zaradi“ → Zadaci (mapa) → pin → kartica → Detalj → „Pošalji ponudu“ → Ponuda → „Prijava je poslata“ → Moje prijave → obaveštenje „Izabran si · *naslov*“ → Dogovor → termin → „Zadatak je gotov“ → ocena.
- **T3 Šta me čeka:** Početna „Čeka te“ (najviše 3: izaberi osobu, predloži termin, potvrdi završetak, oceni, nastavi nacrt; svaka sa naslovom zadatka) → tačno taj ekran i ta radnja. Raspored = samo termini; Obaveštenja = istorija; Poruke = razgovori.
- **T4 Nalog:** Profil → Lični podaci · Radni profil · Obaveštenja · Pomoć · Privatnost · O aplikaciji · Odjava.

## 2. Ekrani

Za svaki: **Svrha** · **Od vrha do dna** · **Komande** · **Dodaje se / Uklanja se** · **Tok**.

### Uskačem

**U1 Zadaci — mapa (lista dole).** Svrha: naći zadatak oko sebe. Od vrha: pilula pretrage „Šta tražiš · Gde“ i odvojeno okruglo dugme filtera (broj uključenih); red plutajućih kapsula: Za mene (samo sa aktivnim radnim profilom), Danas, Ovaj vikend, Na daljinu, Sa iznosom **[proveriti: filter navedene cene postoji]**; mapa preko celog ekrana sa pinovima-kapsulama (iznos ili „Ponude“), grupama; dole desno „moja lokacija“; dole lista sklopljena: ručica, „12 zadataka“ i red „3 nisu na mapi ›“. Navigacija sakrivena. Komande: sve vidljive; filteri = list; pretraga = ceo ekran. Dodaje se: odvojeno dugme filtera, „nisu na mapi“, „Sa iznosom“. Uklanja se: prekidač Svi/Za mene, +/−, velika kutija izvora mape (mali natpis u uglu), navigacija dok je lista dole. Tok: Početna „Uskoči i zaradi“ → ovde; pin → U3; lista gore → U2; pretraga → U4; filteri → U5.

**U2 Zadaci — lista do vrha.** Pilula i kapsule ostaju gore; zaglavlje liste „12 zadataka · Najnovije ▾“ (redosled: Najnovije, Najbliže **[server]**); kartice zadataka zbijene: naslov, red iznosa ili „Tražim ponude“, mesto · udaljenost (od područja rada ili lokacije), vreme, oznaka odnosa („Tvoj“, „Prijavio si se“); plutajuće „Mapa“ iznad navigacije, lista ima prostor ispod poslednje kartice; navigacija vidljiva. Uklanja se: „0/1“, „Tvoj zadatak“ kao natpis iznad naslova (postaje mala oznaka u redu).

**U3 Zadaci — kartica pina.** Kartica skroz dole (lista se skloni), mapa pregledna, izabrani pin sa narandžastim oreolom; kartica: naslov, iznos/„Tražim ponude“, mesto · udaljenost, vreme, lice i ocena onog ko traži; dodir → Detalj; prevlačenje nadole ili dodir na mapu → nazad.

**U4 Pretraga (ceo ekran).** Polje „Šta tražiš?“ sa tastaturom; odeljak „Gde“: gradovi sa brojem („Novi Sad · 23“, vlasnikov izbor „Pretraga A“), „Na daljinu · 3“; skorašnje pretrage. Bez filtera (filteri su U5). Tok: izbor → U1/U2 sa rezultatom i kapsulom pretrage koja se briše jednim dodirom.

**U5 Filteri (list odozdo).** Kada (Danas, Sutra, Ovaj vikend, Izaberi datume), Gde (Svejedno / Na licu mesta / Na daljinu), Iznos (Svejedno / Sa iznosom / Tražim ponude) **[proveriti]**, Redosled; dno: „Očisti“ i zeleno „Prikaži 12 zadataka“ (stvarni broj). „Za mene“ nije ovde (kapsula).

**U6 Detalj tuđeg zadatka.** Gore: nazad, „⋯“ (Podeli, Prijavi zadatak); fotografije (ako ih ima; inače ništa); naslov; činjenice: iznos ili „Tražim ponude“, mesto · udaljenost, vreme, „Treba 2 osobe“ (samo > 1); ko traži: lice, ime, ★ i broj ocena → javni profil; opis; Pitanja (broj) ›; mesto na mapi (približno) sa ⓘ „Ko vidi adresu“; dno: jedino zeleno „Pošalji ponudu“ / „Pošalji prijavu“ (fiksna cena) — vlasnikov izbor. Dodaje se: udaljenost, ko traži pre opisa, ulaz u pitanja. Tok: posle slanja → „Prijava je poslata“ → U8 sa novom označenom.

**U7 Ponuda (forma).** Mali sažetak zadatka; iznos ukupno (kad se traže ponude); „Kada možeš“ (izbor u terminu zadatka); poruka (neobavezno); ⓘ „Šta vidi druga strana“; dno: „Pošalji ponudu“.

**U8 Moje prijave.** Grupe: Čeka odgovor · Izabrana (→ Dogovor) · Završene (sklopljeno); red: naslov, iznos, stanje, vreme; nova prijava označena posle slanja; prazno: predmet + „Pronađi zadatak“.

### Tražim pomoć

**R1 Razgovor sa asistentom (Nova).** Asistent 128 i „Reci šta ti treba.“, tri primera kao redovi; pilula za kucanje (+, tekst, mikrofon, glas); kad asistent razume činjenicu, njena sličica sleti u nacrt (vlasnikov izbor); kad je nacrt spreman: jedno dugme „Pregledaj zadatak“. Izmena postojećeg: isto, ali kraj = „Pregledaj izmene“ i polje nestaje.

**R2 Pregled pre objave — v2 (vlasnik, 8. 10. posle nacrta: „pregled zadatka pre objave treba da bude kao detaljan pregled zadatka, a ne taksativno… čovek vidi kako će izgledati kad je objavljen. I kartica… to je suština: on vidi kako će drugi videti taj zadatak… on treba da vidi tačnu lokaciju, potpunu adresu, a ova može se videti malo manje“).** Kao Airbnb „Pregled oglasa“: ekran JE javni zadatak, ne obrazac. Od vrha: (1) „Ovako ga vide na mapi i u listi“ — prava kartica zadatka (ista komponenta kao U2); (2) „Ovako izgleda kad ga otvore“ — ceo detalj kao U6 (fotografije, naslov, činjenice, ti kao onaj ko traži sa svojim licem i ocenom, opis, približno mesto na mapi); (3) u odeljku mesta, SAMO za tebe: tačna adresa i privatne napomene sa bravom „Vidiš samo ti; osoba sa kojom se dogovoriš vidi je u Dogovoru“ (drugi vide približno — tako je i u objavi). Svaki deo ima malu olovku „Izmeni“ koja otvara baš taj podatak (list sa jednim poljem ili nazad u razgovor). Dno: jedino zeleno „Objavi zadatak“ (izmena: „Potvrdi izmene“); „Obriši nacrt“ crveno na kraju sadržaja. NEMA posebnog spiska stavki ni međukoraka. Tehnički: nacrt se preslikava u isti oblik koji čitaju kartica i javni detalj (bez izmišljanja polja koja nacrt nema).

**R3 Moj zadatak.** Gore: nazad, „Izmeni“ (vidljivo). Blok stanja: „Još nema prijava“ ILI lica (do 3) + „3 prijave“ + jedino zeleno „Pogledaj prijave“; činjenice (iznos/„Tražim ponude“, mesto, vreme, ljudi > 1); opis; Pitanja (1 novo) › — odgovaraš ovde; mesto; „Objavljen pre 2 sata“; dno: „Otkaži zadatak“ crveno (potvrda u listu). Uklanja se: „Čekaš prijave. Vidiš ih ovde i u zvoncu.“, „Dogovoreno 0/1“, „⋯“ kao jedini put.

**R4 Prijave (izbor osobe).** Naslov zadatka gore; redosled: Najniža cena · Najbolja ocena · Najranije **[server ili cela lista]**; kartica ponude: lice, ime, ★ i broj ocena, iznos desno, „Može: sub 10–14“, poruka (2 reda), „Izaberi“; izbor → list sa sažetkom i „Izaberi osobu“ → „Dogovoreno!“ (dva lica i naslov, vlasnikov izbor C) → Dogovor.

**R5 Moji zadaci.** Grupe po fazi (vlasnikov izbor A): Čeka tvoj izbor (lica) · Objavljeno · Dogovoreno; redovi Nacrti (1) i Istorija; red: naslov, stanje, broj prijava. Prazno: papir sa pinom + „Objavi zadatak“.

### Zajedno

**Z1 Početna.** Znak, zvono, lice; dve velike pločice (zaključano); „Sledeće“: krupno vreme sledećeg Dogovora („Danas u 14:00“, naslov, sa kim) samo kad postoji (izbor B); „Čeka te“ najviše 3 (radnja + naslov zadatka, bez treće rečenice); redovi Moji zadaci (8 aktivnih · 1 nacrt) i Moje prijave (1 čeka odgovor); „Mogu odmah“ (samo sa aktivnim radnim profilom, isto ime svuda). Uklanja se: slab red rasporeda, „Slobodan sam sada“, duple rečenice.

**Z2 Dogovor — Pregled.** Gore: nazad, lice + ime + uloga („Traži pomoć“ / „Uskače“), zvono; tabovi Pregled · Poruke; naslov; koraci kratko: Dogovoreno · Gotovo · Potvrđeno · Ocena (nikad prelomljena reč) + ⓘ „Kako ide do kraja“; kartica sledećeg koraka sa jedinim zelenim dugmetom („Predloži termin“ / „Zadatak je gotov“ / „Potvrdi završetak“ / „Oceni“); činjenice: Kada (po vremenu u Srbiji), Gde = tačna adresa (samo u Dogovoru) + „Otvori u mapama“ (spoljna mapa, bez plaćenog ključa), Iznos; vidljivi redovi: Izmeni uslove, Prijavi problem; odvojeno crveno: Otkaži Dogovor, Prijavi ili blokiraj osobu. Dodaje se: „Otvori u mapama“, kartica sledećeg koraka. Uklanja se: „⋯“ kao jedini put, dve rečenice objašnjenja.

**Z3 Dogovor — Poruke.** Razgovor; glasovna poruka drži-i-pusti (šalje na puštanje); fotografije; poruke sistema (termin predložen, gotovo) kao tihe oznake u toku razgovora.

**Z4 Dogovori.** Aktivni · Istorija + ikonica kalendara (Raspored, jedini ulaz); kartica: naslov, sa kim (lice), sledeći korak ili termin; Istorija: filter Svi/Završeni/Otkazani (postoji).

**Z5 Raspored — v2, kalendar (vlasnik, 8. 10.: „prikaz kalendara, kalendar obaveza… treba da bude dosta bolje, a ne samo ti neki datumi gore… nema čovek pregled celog meseca, nedelje, dana… nađu neka lepa svetska UI/UX rešenja“).** Uzori: Apple Kalendar (mesec sa tačkama + spisak izabranog dana ispod), Google Kalendar (raspored po danima, dan kao vremenska traka sa linijom „sada“), Fantastical (traka dana + spisak), Airbnb kalendar domaćina (ceo mesec na prvi pogled, prevlačenje meseci). Ekran: gore „Raspored“, dugme „Danas“ i prekidač prikaza **Mesec · Nedelja · Dan**; iznad svega, ako ih ima, traka „2 Dogovora bez termina ›“ (vodi na „Predloži termin“).
- **Mesec (podrazumevano):** mreža 7 × 5–6 sa danima; ispod broja dana do dve tačke u boji (Dogovor u kome uskačem / Dogovor za moj zadatak) i „+1“ kad ih je više; danas zaokružen, izabrani dan pun; dani kad mogu da radim (dostupnost radnog profila) blago osenčeni, samo za one sa radnim profilom; prevlačenje levo/desno menja mesec; ispod mreže spisak izabranog dana: vreme, naslov zadatka, lice i ime druge strane, mesto; dodir → Dogovor.
- **Nedelja:** sedam dana jedan ispod drugog (raspored po danima, kao Google „Schedule“), svaki dan sa svojim Dogovorima (vreme, naslov, lice) ili tihim „Slobodno“; prevlačenje menja nedelju; gore mala traka dana sa tačkama.
- **Dan:** vremenska traka 7–22 h (pomera se na celih 24), Dogovori kao blokovi od-do sa naslovom i licem, crvena linija „sada“, dostupnost kao osenčen pojas; dodir na blok → Dogovor.
- Dole: „Moja dostupnost ›“ (samo sa radnim profilom) i „Arhiva ›“. Samo Dogovori (bez mojih objava i prijava); vreme „po vremenu u Srbiji“ kad je telefon u drugoj zoni; jedan izraz „Fleksibilno“; legenda dve boje iza ⓘ.

**Z6 Poruke.** Aktivni · Završeni; red: lice 48, ime + vreme, pregled 1 red, naslov zadatka 1 red, broj nepročitanih; bez katanca. Spinner osvežavanja samo kad se povuče.

**Z7 Obaveštenja.** Danas · Juče · datum; red: događaj + naslov zadatka **[server: INBOX-NASLOV]** + vreme desno, sličica u boji uloge; tabovi Sve · Moji zadaci · Moje prijave; zupčanik → podešavanja. Uklanja se: „· Otvara …“ (ostaje samo za čitač ekrana).

### Profil i nalog

**P1 Profil.** Lice 96 (pouzdano, inicijal dok se učitava), ime, grad; brojevi: ocena · završeno · treći samo kad postoji; „Kako te drugi vide ›“ (javni profil); Uskakanje: Radni profil („Aktivan · Moleraj · Novi Sad, 100 km“); Nalog: e-pošta (tihi red), Obaveštenja, Promeni lozinku; Pomoć: Podrška (broj otvorenih), Prijavi grešku; Privatnost: Privatnost i podaci, Blokirane osobe (Nema / 2), Izvoz podataka (Nije tražen), Pravila i saglasnosti; O aplikaciji (Verzija 1.0.0); Odjavi se. Olovka gore = Lični podaci. Uklanja se: Područje rada, Dostupnost, Raspored sa Profila; opisi u podnaslovima; dve brave.

**P2 Lični podaci.** Fotografija u krugu + „Promeni fotografiju“; IME — jedino mesto (vlasnik: „jedno ime za sve“), upisuje se i u nalog i u radni profil; O meni ›; Grad › (vodi u Područje rada); jedna rečenica „Ime, fotografija, grad i ocene vide drugi.“; „Sačuvaj“ u zaglavlju tek kad se nešto promeni. Uklanja se: stalno sivo „Sačuvaj ime“, pasus od pet redova, red Privatnost i podaci.

**P3 Radni profil.** Kartica „Kako te vide kao radnika“ (lice, ime naloga, vrste posla, ★); Šta radiš (čipovi) ›; Gde (Novi Sad · 100 km) ›; Kada: „Mogu odmah“ (prekidač) i Nedeljni raspored ›; Oprema: Alat · 10 ›, Vozila · 12 ›; „Popuni uz asistenta“ (sporedno). Uklanja se: polje imena, „samo informacija“, dugački nizovi sa tačkama, „Mogu odmah · dostupnost“.

**P4 Podešavanja obaveštenja.** Jedan ekran: Ovaj telefon (stanje + „Poveži ovaj telefon“), Kad objavljuješ (Prijave i poruke; Ostalo), Kad uskačeš (Novi zadaci; Prijave i poruke; Ostalo), Tihi sati, Napredno; jedna rečenica na dnu; ⓘ za tihe sate.

**P5 Privatnost i podaci.** Čvorište: Ko šta vidi (ⓘ), Rokovi čuvanja ›, Izvoz podataka (stanje) ›, Blokirane osobe (broj) ›, Pravila i saglasnosti (Još nisu objavljena) ›, Zatvaranje naloga ›. Sve činjenice ostaju; „nije dostupno“ najviše jednom po ekranu.

## 3. Jezik dizajna (ujednačavanje)

- **Boje:** crn glavni tekst, siv sporedni, bele površine; jedna zelena glavna radnja po ekranu; narandžasto samo za „tvoje je da uradiš“ i izabrani pin; crveno samo za otkazivanje/brisanje/prijavu.
- **Ikonice:** dve porodice — 2.5D u boji uloge za stvari i stanja (mesto smaragd, vreme zlatna, ljudi koral, asistent plava, novac), obične linijske za komande; bez sivih 2.5D osim pročitanog/neaktivnog.
- **Slova:** Inter, sedam veličina, bez ručnih; tekst ≥ 12.
- **Kartice:** samo zapis koji se dodiruje kao celina (zadatak, Dogovor, ponuda); podešavanja su redovi; nikad kartica u kartici.
- **Tekst:** jedan rečnik (Zadatak, Prijava, Ponuda, Dogovor, Termin, Mogu odmah, Fleksibilno, Tražim ponude), „ti“ bez roda, najviše jedna rečenica objašnjenja po ekranu, ostalo iza ⓘ.
- **Pokret:** kartica se otvara u detalj bez skoka (cilj, izvodljivost se proverava), listovi klize mekano, sadržaj ulazi blago, obris umesto vrteške, tik na uspeh, „Dogovoreno!“ trenutak; sve poštuje „smanji pokret“.

---

<a id="revizija-20261008"></a>
## Revizija posle predaje 8.10 — SOURCE audit i predlog za pregled

**Status: PREDLOG, NIJE ODOBRENA IMPLEMENTACIJA.** Izvor `f1ddd54d4ff9c61a6c7f1da443d56cc1452068f6`; obe grane na remote-u `novi` proverene na istom HEAD-u. Radni checkout čist pre ovog dokumentacionog paketa.

**DEV read-only:** ledger **235**, closure digest **3a785d42**. Funkcije `rpc_discovery_v1`, `rpc_list_my_needs_page`, `rpc_list_my_agreements_page`, `fn_need_urgency` postoje; authenticated ima EXECUTE. To nije dokaz svih RLS scenarija, sveže baze ili performansi. Stara tvrdnja „ne postoje na DEV-u“ nije trenutno tačna. HITNO i platform payments su isključeni; public trust OWN_ONLY, detail reviews COMMENTED_ONLY. Jedanaest Edge funkcija ima ACTIVE metadata, nije izvršena poslovna/provajderska proba.

**Telefon:** 4e0ea506 / versionCode35 / rs.uskoci.preview po predaji. Nema novog PHONE/EMULATOR testa. Pregledano10 vlasnikovih slika od12:25–12:57, pre večernjeg talasa; ne koristiti stare slike kao dokaz da današnja popravka ne radi. Nema tvrdnje „bez grešaka“ ili „release ready“.

**Obuhvat:** 50 produkcionih ulaznih fajlova (uključuje redirect-e i uslovni operator), svih62 stavki registra, import/controls/overlay/RPC/flag inventar nad 697 source modula. Semantički produbljene proizvodne porodice, ne garancija da je svaki red koda nezavisno verifikovan. Statički graf može uključiti zajedničke, uslovne i neaktivne reference. Detaljan mašinski inventar: [WHOLE_APP_ROUTE_AUDIT_20261002.json](WHOLE_APP_ROUTE_AUDIT_20261002.json), polje review_20261008.

**Pogledaj:** [interaktivne skice ekrana i alternativa](PREDLOG_EKRANA_20261008.html). Fiktivni primeri, originalni postojeći artwork; nije screenshot aplikacije, backend nije povezan.

### 1. Zaključak proizvoda

USKOČI ima stvarnu povezanu osnovu. Objava koristi prepare/read/accept/evaluate/publish ugovor; ne zavisi od toga da li je stari publishNeed wrapper pozvan. AI već potvrđuje pin i pojedinačne tačke, skuplja potvrđenu lokaciju i daje pregled. Dogovor ima capabilities, promene, otkazivanje, završetak i ocene;1:1 poruke imaju outbox/read/incoming putanje. Nije opravdano ponovo graditi ove sisteme.

Najveći dobitak:1) poravnati1:1/grupno iskustvo bez gubitka drafta i dodatnog koraka slanja;2) iskren opseg i ukupni brojevi lista;3) oba AI razgovora složiti po modelu jedna aktivna potvrda→kratak trag→konačni pregled;4) razdvojiti važnost informacija, a ne samo presvući sve u novu zelenu.

### 2. Odluke koje čekaju prikaz i vlasnika

| Odluka | Varijante | Preporuka | Zašto nije tiha promena |
|---|---|---|---|
| Navigacija |3: Početna/Zadaci/Dogovori sa Porukama u Dogovorima;4: postojeći zaseban Poruke |4 zbog direktnog ulaza u razgovore |Novi uvod kaže3, code/canon7.10 kaže4. Nijedno nije sada promenjeno. |
| Pretraga |A: polje uz listu;B: uvek dostupna, potvrda otvara FULL rezultate;C: vođene sekcije |B, filteri zaseban sheet |Novi iskaz je sklonost, ne odluka. |
| Mapa/lista |Postojeći detenti;alternativni Mapa/Lista prekidač |Zadržati detente |Prekidač kao zamena samo ako vlasnik izričito promeni odluku. U skici vidljiv samo povratak Mapa, ne nova paralelna navigacija. |
| Kartice/Početna/Profil |Kompaktna kompozicija u galeriji |Usvojiti po ekranu tek posle prikaza |Današnja verzija nije plafon, ali nema samostalne zamene. |
| Ruta |Tačke+spoljna navigacija;stvarna interna drumska linija |Prvo jasno postojeće tačke |Nova geometrija zahteva provider/cost/privacy odluku. |

### 3. Jedinstven vizuelni sistem — predlog evolucije postojećeg sys

| Oblast | Pravilo za sledeći odobreni paket |
|---|---|
| Boja |Bele čitajuće površine#FFF;ink#202020;secondary#525252;green#00845A za jednu glavnu radnju;orange#FF7A1A za pažnju/brand. Neutralne kontrole#F7F7F7, bez mentol ploča. Status uvek i rečima. |
| Tipografija |Inter zadržati. Screen naslov24–28 zavisno od postojeće porodice;list title16–20;body16;secondary14;caption12 minimum;price23/28 samo važan iznos. Ne uvoditi novi font ni nasumične vrednosti po ekranu. Mapirati na postojeće sys role pa konsolidovati višak u posebnom paketu. |
| Ritam |Gutter20, chat16/composer12, map inset16;spacing4/8/12/16/24/32/48. Grupa12, sekcija24, veća zona32. Dug sadržaj dobija prostor, ne sve isti rectangle. |
| Površine |Record card samo dodirljiva celina;settings obični redovi;AI odgovor na belom bez kutije;korisnički balon diskretno neutralan u predlogu;pending jedan inline status. Bez card-in-card. |
| Shape/elevation |Postojeći control12/card24/sheet28;pill za izbor ili composer, ne za pasus. Senka na sloju sheeta i retkom podignutom ulazu;list red odvojen ritmom/inset1dp. |
| Ikone |Funkcionalne male ikone iz postojeće familije;FactArt28 za stvarne činjenice;32–48 row art;64 Home vrata;88–128 robot samo prazan start. Bez emoji-ja, novih proizvoljnih category ikona ili ukrasne ikone uz svaku reč. |
| Materijal |Originalni postojeći pin/notes/money/calendar/people/remote. Jedan smer svetla, dosledan satin/plastika/papir. Boja objekta daje živost, ne svaki background. Nov artwork odobriti pre zamene. |
| Stanja |Pressed120ms;selected tekst+shape;disabled objašnjen razlog;loading zadržava širinu;error kod konkretnog polja;unread dot+weight;confirmed tek receipt;unknown Proveri. |
| Adaptacija |361dp osnovna skica;320/360/412 i1.0/1.15/1.3font native provera kasnije.48dp touch;dug srpski tekst wrap;ne fiksirati visinu content reda. Max širina640 iz postojećeg layout-a. |
| Artwork performanse |Izvorni PNG-ovi imaju približno0.7–2MB po fajlu. To nije izmereni memory problem. Pre novih setova izmeriti decode/cache i pripremiti odobrene manje izvoze; zadržati proporcije i transparentnost. |

### 4. Motion i navigation ugovor

| Interakcija | Predlog ponašanja | Greška koju sprečiti |
|---|---|---|
| Pin→Peek |Halo odmah;Peek sledeći frame;camera nezavisno do360ms samo ako potrebno |Ne čekati mrežu/animaciju kamere da korisnik vidi izbor |
| Sheet |Jedna UI-thread pozicija vodi sheet/tabove/attribution/locate;postojeći spring bez bounce |Više nezavisnih transformacija koje se razilaze |
| Search/filter |Enter240/exit160;draft pa atomic apply;keyboard Back prvo |Flash prazne mape i izgubljeni kriterijumi |
| List→detail→Back |Sačuvati query/offset/selectedID;ne ponavljati stagger |Skok na vrh ili novi cold skeleton pri toplom povratku |
| AI |Stvarni stream;jedna aktivna mapa;collapse nakon potvrde;final preview na kraju |Lažni typewriter i svaki fact kao nova ogromna kartica |
| Message |Optimistic appearance120–180ms;receipt zameni isti item;pagination bez animacije |Duplikat ili nova animacija svih starih poruka |
| Dogovoreno |Postojeći kratki brand moment posle receipt-a;CTA odmah moguć |Animacija koja obećava uspeh pre servera |
| Settings/calendar |Lokalna visina disclosure-a;isti datum/fokus ostaje pri promeni režima |Nepotreban horizontalni carousel za svaki podatak |
| Robot |Blink/mala promena izraza samo iz ispravnog asset-a;focus-only |Rastezanje statične slike, beskrajno motion na listi |
| Reduce Motion |Isti sadržaj i komande;bez translation/scale,kratak fade ili odmah |Ukidanje pristupačnosti da bi dizajn bio premium |

Android Back: prvo sistemska tastatura;zatim modal/editor (dirty confirm kada treba);zatim interni tab/context;zatim poreklo rute;na root-u sistemski izlaz. Deep link najpre auth/capability pa tačan ID;ne preusmeravati po naslovu. Foreground vrati javni snapshot, privatno tek posle revalidacije;nalog promena poništava sve stare callbacks.

### 5. Registar nalaza i minimalne popravke

#### D01 · P1 · performance
**Problem:** Ulaz Nisu na mapi može uzastopno učitavati mnoge stranice. **Zašto:** Lokalni filter pinless redova se dopunjava čitanjem cele kolekcije do očekivanog broja; jedan dodir može biti skup.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/v2/DiscoveryPresentation.tsx:376`; `src/ui/v2/DiscoveryPresentation.tsx:1189`
**Predlog:** Bounded dopunjavanje i iskren učitani broj; zaseban pinless server scope ako je potreban. Ne vraćati P6 na početak.
**Kasniji focused dokaz:** Sintetički mnogo mapiranih pre prvog pinless reda: ograničen broj poziva po korisničkoj akciji, lista i broj po istom upitu.
**Odobrenje:** UI predlog + posebno odobrenje server ugovora ako se proširuje. **Registar:** B04, B05.

#### D02 · P1 · UX
**Problem:** Izbor poznatog grada zatvara pretragu umesto da ponudi delove grada. **Zašto:** OnWithin imaju fallback gradovi, dok gradovi iz rezultata odmah primenjuju scope.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/v2/discovery/PlacePicker.tsx:77`; `src/ui/v2/discovery/PlacePicker.tsx:104`; `src/ui/v2/discovery/PlacePicker.tsx:117`
**Predlog:** Odvoji Ceo grad od Izaberi deo grada. Ulice nuditi samo gde stvarni provider i javni ugovor to daju.
**Kasniji focused dokaz:** Isti Novi Sad i iz recent i iz rezultata nudi isti izbor; Back iz naselja vraća grad bez primene.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** B05.

#### D03 · P2 · UX odluka
**Problem:** Obična potvrda pretrage ne podiže listu rezultata. **Zašto:** Komentar u panelu obećava listu, apply menja filter i kameru, remote ima zaseban put. Nije automatski kvar važećeg smera.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/v2/discovery/DiscoverySearchPanel.tsx:27`; `src/ui/v2/DiscoveryPresentation.tsx:835`
**Predlog:** Prikazati A: polje uz listu, B: pretraga uvek dostupna pa FULL rezultati, C: vođene sekcije. Preporuka B.
**Kasniji focused dokaz:** Posle izbora grada/reči rezultat očigledan; Mapa vraća oblast; tastatura ne pomeri mapu.
**Odobrenje:** OBAVEZNA odluka vlasnika između prikazanih alternativa. **Registar:** B05, B04.

#### D04 · P2 · UX/owner contract
**Problem:** Na daljinu nije pouzdano prva kapsula. **Zašto:** Za mene i aktivni filteri mogu da se umeću pre nje.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/v2/discovery/DiscoveryChipRow.tsx:40`; `src/ui/v2/DiscoveryPresentation.tsx:878`
**Predlog:** Fiksno Na daljinu prva; izbor označen tekstom+stanjem; druge aktivne uslove sažeti posle osnovnih.
**Kasniji focused dokaz:** Razne kombinacije filtera i profila ne pomeraju prvu kapsulu.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** B04, B05.

#### D05 · P2 · data UX
**Problem:** Peek više zadataka na istoj tački može prikazati broj prve učitane strane kao ukupan. **Zašto:** POINT_MEMBERS ima limit50, presentation dobija items bez marker total-a.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/data/discoveryV1ScreenSession.ts:226`; `src/ui/v2/discovery/DiscoveryPeek.tsx:90`
**Predlog:** Preneti total odvojeno od preview članova: tri reda + Prikaži svih N.
**Kasniji focused dokaz:** Tačka sa 51+ zadatkom kaže ukupno N bez čitanja svih radi naslova.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** B04.

#### D06 · P2 · error recovery
**Problem:** Neuspešan preview filtera onemogućuje primenu bez retry-a u panelu. **Zašto:** Korisnik mora da menja uslov ili zatvara panel da bi ponovio.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/v2/discovery/DiscoverySearchPanel.tsx:168`
**Predlog:** Ponovi u istom footer-u, zadrži draft i stare rezultate do autoritativne zamene.
**Kasniji focused dokaz:** Preview fail→retry čuva datum i mesto; nije potrebno Očisti.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** B05.

#### D07 · P2 · visual/performance risk
**Problem:** Native marker sloj dopušta preklapanje simbola i teksta. **Zašto:** Geografski bucket-i nisu isto što i čitljiv raspored etiketa na 361dp.
**Dokaz:** SOURCE rizik; stvarno preklapanje nije izmereno u ovom auditu. `src/ui/v2/discovery/DiscoveryV1ServerMarkerLayer.tsx:69`
**Predlog:** Guste grupe nose broj; tačke bez svake cene; odabrani ima prioritet. Posebno proveriti screen-space kolizije.
**Kasniji focused dokaz:** Gusta mapa pri 361dp: izabrani vidljiv, nijedan aktivni dodir ne vodi na pogrešan pin.
**Odobrenje:** Skica odobrenje, potom native dokaz; ne menjati backend automatski. **Registar:** B04.

#### D08 · P2 · visual/state
**Problem:** P6 pin nema isti relationship prikaz kao legacy pin. **Zašto:** Native sloj prima kind/count/selected, ne own/applied. Demo ne sme predstavljati legacy kao aktivni P6.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/v2/discovery/DiscoveryV1ServerMarkerLayer.tsx:8`; `src/ui/v2/DiscoveryMap.tsx:539`
**Predlog:** Neutralni pin; svoj mali znak, prijavljen mali tick samo uz poznat odnos; selected halo prvi prioritet. Nepoznato nije tuđ.
**Kasniji focused dokaz:** Own/applied/selected/unknown kombinacije; card i pin isti id.
**Odobrenje:** Vlasnik odobrava oblik; postojeći overlay povezati samo ako daje autoritativnu relaciju. **Registar:** B04.

#### D09 · P3 · copy
**Problem:** Globalno prazno stanje prvenstveno nudi Osveži, uz tekst koji podrazumeva mapu za sve. **Zašto:** Remote zadatak ne mora imati pin; refresh ne menja prazan skup.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/v2/discovery/DiscoveryListState.tsx:55`
**Predlog:** Prazan skup: Objavi zadatak; prazan filter: Promeni uslove; mrežna greška: Ponovi.
**Kasniji focused dokaz:** Tri uzroka imaju tri odgovarajuće radnje.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** B04.

#### D10 · P2 · perceived performance
**Problem:** Jedan read error može ukloniti izvedenu listu iako koordinator ima prethodnu sliku. **Zašto:** Map-only, marker, page i cold greške nemaju uvek isti efekat po korisnika.
**Dokaz:** SOURCE izveden scenario; potrebno potvrditi tačan runtime put. `src/ui/v2/discovery/DiscoveryV1Screen.tsx:97`; `src/ui/v2/DiscoveryPresentation.tsx:440`
**Predlog:** Razdvojiti cold fail od stale refresh/next-page/marker fail; zadrži stare podatke uz jasnu oznaku.
**Kasniji focused dokaz:** Focused fault injection po read vrsti; izbor/offset ostaju, greška ne glumi nula zadataka.
**Odobrenje:** Odobren prikaz recovery stanja. **Registar:** B04.

#### D11 · P2 · visual hierarchy
**Problem:** Dugački naslovi i svaki fact u zasebnom visokom redu šire list kartice. **Zašto:** Na listi odluka postaje spora; veliki detalj i kartica imaju sličnu težinu.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/v2/discovery/TaskRecordBody.tsx:176`
**Predlog:** Naslov do2 reda u listi, iznos ispod, lokacija/termin kompaktno; detalj zadržava pun naslov i sve činjenice.
**Kasniji focused dokaz:** Dug naslov, ponuda bez iznosa, 3 osobe, remote, 1.3font: čitljivo bez horizontalnog overflow.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** B04, B06.

#### AI01 · P1 · UX/state
**Problem:** Završen radnički razgovor zadržava onemogućen unos. **Zašto:** Worker ne šalje closed shell-u, task već šalje.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/app/(app)/profil/razgovor.tsx:371`; `src/ui/aiFirst/AiConversationShell.tsx:374`
**Predlog:** Završni sažetak i Otvori radni profil, bez praznog neaktivnog composer-a.
**Kasniji focused dokaz:** Save→Back u thread COMPLETED i ABANDONED: nema lažnog unosa; READY ostaje razgovor.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** B00.

#### AI02 · P2 · visual/UX
**Problem:** Dva AI razgovora nemaju isti model sažetka i završetka. **Zašto:** Worker kartica/progress/disclosure dominira drugačije od task završne kartice na kraju.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/workerProfile/WorkerAiPresentation.tsx:31`; `src/ui/v2/IntakePresentation.tsx:397`
**Predlog:** Jedan aktivan korak, sklopivi sažetak stvarnih činjenica, završni pregled na kraju; sadržaj različit po nameri.
**Kasniji focused dokaz:** Duga istorija+keyboard, odgovor sa0/1/više činjenica, kraj oba toka: jedna glavna radnja.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** A02, B00.

#### AI03 · P2 · product clarity
**Problem:** Interna mapa rute crta tačke, ne drumsku geometriju. **Zašto:** Cela ruta postoji kao Google Maps URL; nije dokaz da app crta put između tačaka.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/location/LocationOverviewMap.tsx:101`; `src/ui/location/LocationMapPreview.tsx:69`
**Predlog:** Sažetak Polazište→usputne→Odredište; overview numerisanih tačaka i otvori navigaciju. Pravu putanju samo iz provider ugovora.
**Kasniji focused dokaz:** Tri tačke, neuspeo reverse lookup, jedna pomerena: redosled i privatnost očuvani.
**Odobrenje:** Odobrenje prikaza; novi provider/naplata/server posebno. **Registar:** A04, A06, B06, D08.

#### AI04 · P3 · state continuity
**Problem:** Cold start može vezati potvrđenu lokaciju/slike uz poslednju učitanu poruku. **Zašto:** In-memory anchor map nije trajna istorija događaja; podatak nije izgubljen, ali timeline se pomera.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/v2/IntakePresentation.tsx:45`
**Predlog:** Dugoročno stabilan event/message anchor; dotad ne obećavati identičan položaj posle restarta.
**Kasniji focused dokaz:** Resume/cold start/pagination: samo jedna potvrđena lokacija, bez dupliranja.
**Odobrenje:** Server promena ako se uvodi anchor mora posebno biti odobrena. **Registar:** A02, A04, A05.

#### AI05 · P2 · copy/semantic
**Problem:** Završna rečenica izmene prepoznaje se doslovnim string-matchom. **Zašto:** Promena prompt teksta može vratiti poziv na objavu umesto izmene.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/v2/IntakePresentation.tsx:247`
**Predlog:** Postojeći Edge paket završiti jasnim intentom edit/create; nema novog AI sistema.
**Kasniji focused dokaz:** Promena interpunkcije/rewording ne menja semantiku sledeće radnje.
**Odobrenje:** Edge paket preflight/revert/vlasnikova reč. **Registar:** A13.

#### AI06 · P2 · UX
**Problem:** Ručna ispravka područja u worker predlogu traži ISO državu i broj radijusa. **Zašto:** Korisnik misli u mestima, ne RS parametrima.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/workerProfile/WorkerAiPresentation.tsx:272`
**Predlog:** Postojeći area picker u draft kontekstu; Sačuvaj predlog ne sme neprimetno da menja live profil.
**Kasniji focused dokaz:** Izmena područja→Back→frozen review zadržava scope; nema ranog live upisa.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** B00, B02.

#### SEL01 · P1 · UX
**Problem:** Poređenje je na HONOR širini jedna kolona. **Zašto:** Dve kolone traže≥200dp svaka, a logička širina je≈361dp. To nije paralelno poređenje.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/v2/ApplicationSelectionPresentation.tsx:209`
**Predlog:** Izaberi dva; isti redovi iznos/termin/ljudi/ocena u dve čitljive kolone, detalji niže. Ne automatski najbolji.
**Kasniji focused dokaz:** 361dp i1.15font, dug naziv: iste činjenice naspram istih, ≥48dp kontrole.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** A11.

#### SEL02 · P2 · navigation
**Problem:** Promena lista/poređenje remountuje FlatList. **Zašto:** Key zavisi od režima; u komponenti nema offset restore.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/v2/ApplicationSelectionPresentation.tsx:242`
**Predlog:** Sačuvaj izabranog kandidata kao anchor i položaj liste; poredi samo2–3.
**Kasniji focused dokaz:** 50 redova→poredi dva pri dnu→Back: isti kandidat i položaj.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** A11.

#### SEL03 · P2 · performance
**Problem:** Poređenje može zatražiti sve stranice kandidata. **Zašto:** Globalni sort je pošteno sakriven dok se ne učitaju svi; nije skalabilno za veliku listu.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/app/(app)/potrebe/[id]/kandidati.tsx:33`
**Predlog:** Server keyset sort kao odvojeni paket; izabrani2 porediti bez pražnjenja celog pager-a.
**Kasniji focused dokaz:** Poređenje2 posle jedne strane ne čita1000 kandidata.
**Odobrenje:** Server odobrenje zasebno. **Registar:** A11.

#### TASK01 · P3 · content contract
**Problem:** publishedAt još nije u owner read projekciji. **Zašto:** Ne može se pouzdano prikazati Objavljen pre… iz lokalnog vremena.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/app/(app)/potrebe/[id]/pregled.tsx:342`
**Predlog:** Zatvoriti već poznat server paket pa povezati; do tada datum ne izmišljati.
**Kasniji focused dokaz:** Stari task/cold start pokazuju isti serverski datum.
**Odobrenje:** Server odobrenje zasebno. **Registar:** A08.

#### COM01 · P1 · UX/state
**Problem:** Grupa briše neposlati draft pri blur/background. **Zašto:** Kratak poziv ili prelazak drugde gubi tekst.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/groups/GroupConversationScreen.tsx:17`
**Predlog:** In-memory draft po nalogu+grupi, brisanje na logout/odbacivanje; journal ostaje zaseban.
**Kasniji focused dokaz:** Napiši→background→vrati; isti draft. Drugi nalog nikad ne vidi prvi draft.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** D05.

#### COM02 · P1 · state sync
**Problem:** Otvorena grupa nema isti incoming refresh kao1:1. **Zašto:** Focus/manual/send osvežava; dolazak tuđe poruke bez toga nije povezan u controller-u.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/groups/GroupConversationPresentation.tsx:115`; `src/ui/groups/GroupConversationController.ts:1`
**Predlog:** Bounded invalidation za otvorenu grupu, stabilan scroll, bez stalnog ručnog Osveži. Text-only ostaje.
**Kasniji focused dokaz:** Dva test naloga: incoming vidljiv bez Back; dok čita stare poruke ne skače na dno.
**Odobrenje:** Client paket kasnije; server ako treba posebno. **Registar:** D05.

#### COM03 · P1 · UX
**Problem:** Uspešno slanje grupe skriva unos i traži Prikaži razgovor. **Zašto:** CONFIRMED je dead end za kontinuirano dopisivanje.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/groups/GroupConversationController.ts:70`; `src/ui/groups/GroupConversationPresentation.tsx:153`
**Predlog:** Receipt automatski reconcile-uje poruku; composer ostaje. Samo UNKNOWN nudi Proveri.
**Kasniji focused dokaz:** Tri uzastopne poruke bez dodatne potvrde, retry nikad ne šalje novi id.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** D05.

#### COM04 · P1 · data UX
**Problem:** Aktivni/Završeni filtrira samo učitanu stranu inboxa. **Zašto:** Prazan lokalni rezultat može biti proglašen globalno praznim uz nextCursor.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/messages/ConversationInboxPresentation.tsx:107`
**Predlog:** Prvo iskren tekst i bounded paging; zatim lifecycle filter/cursor u server projekciji.
**Kasniji focused dokaz:** Prva strana sve zatvoreno, druga aktivno: ne prikaži lažno Nema aktivnih.
**Odobrenje:** Server odobrenje posebno; klijentski prikaz pre integracije. **Registar:** D03.

#### COM05 · P2 · performance/sync
**Problem:** Inbox i drugi potrošači čitaju celu kolekciju Dogovora. **Zašto:** useClosedAgreements koristi reader do20×100; inbox refresh ne osvežava uvek taj skup. Home paralelno čita own tasks/apps i celu kolekciju Dogovora.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/messages/useClosedAgreements.ts:21`; `src/data/agreementClientService.ts:586`; `src/app/(app)/index.tsx:1`
**Predlog:** Projekcija inbox lifecycle i bounded Home/agenda agregati; ne učitavati celu istoriju radi jednog broja. Izmeriti pre promene.
**Kasniji focused dokaz:** 1/100/1000 dogovora: broj poziva/payload; zatvaranje+refresh odmah menja odeljak.
**Odobrenje:** Server odobrenje posebno; ovo nije dokaz opšte spore aplikacije. **Registar:** D03, A01, B12.

#### COM06 · P2 · known pending
**Problem:** Unread1:1 nije prikazan; count samo za grupu. **Zašto:** Ne treba lažno nacrtati0 ni izmišljeni broj u novom dizajnu.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/messages/ConversationInboxPresentation.tsx:188`
**Predlog:** Prvo odgovarajući server ugovor iz handoff-a, zatim ista count semantika.
**Kasniji focused dokaz:** Dva naloga/prava poruka: vidljivost→read receipt→badge opada tačno jednom.
**Odobrenje:** Server/push test samo uz odobrenje. **Registar:** D03, P01.

#### IA01 · P2 · IA/visual
**Problem:** Profil i Privacy hub ponavljaju iste privatnosne izlaze. **Zašto:** J1 jedan dom gubi smisao; profil postaje duga postavka.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/profile/ProfileHubPresentation.tsx:145`; `src/ui/privacy/PrivacyPresentation.tsx:79`
**Predlog:** Profil identitet+radni profil+Nalog+Privatnost i podaci+Pomoć. Privacy ima izvoz/blokirane/pravila/brisanje; deep link prečice ostaju.
**Kasniji focused dokaz:** Svaka funkcija dostupna jednim jasnim putem; Back vraća scroll.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** N05, N09, N11, N06.

#### A11Y01 · P2 · accessibility
**Problem:** Spoken label obaveštenja ne koristi isti taskTitle kao vizuelni red. **Zašto:** Više istih događaja nad različitim zadacima može zvučati identično.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/notifications/InboxPresentation.tsx:120`; `src/ui/notifications/InboxPresentation.tsx:151`
**Predlog:** Accessibility label iz istog rowCopy modela; događaj+zadatak+vreme+unread.
**Kasniji focused dokaz:** TalkBack razlikuje dva otkazana zadatka; swipe radnja ima alternativu.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** P01.

#### UX01 · P2 · visual hierarchy
**Problem:** Dogovor lista može sabrati mnogo upozorenja i visokih fact redova. **Zašto:** Komentar max160dp nije realno ograničenje složenog stanja.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/agreements/AgreementListCard.tsx:86`
**Predlog:** Naslov+osoba, jedan najvažniji sledeći korak, termin/iznos. Ostalo detalj. Bez obaveznog dodatnog expand pre svakog detalja.
**Kasniji focused dokaz:** 6 različitih statusa: odmah jasno ko čeka koga, ne istih6 velikih kartica.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** D01, D02.

#### UX02 · P3 · copy/composition
**Problem:** Grupa i podrška imaju trajne tehničke pasuse i ručne read kontrole. **Zašto:** Sadržaj razgovora dobija manji prostor; korisnik mora da razume internu operaciju.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/groups/GroupConversationPresentation.tsx:84`; `src/ui/support/SupportDetailScreen.tsx:191`
**Predlog:** Grupna koordinacija info disclosure; podrška Prethodne poruke; read-on-visible uz isti guard i zaseban dokaz.
**Kasniji focused dokaz:** Pravni smisao ostaje dostupan; samo vidljive poruke mogu biti pročitane.
**Odobrenje:** Prikaz odobriti pre integracije; bez nove poslovne odluke. **Registar:** D05, N08.

#### VIS01 · P3 · brand opportunity
**Problem:** Robot je jedna statična glava, ne animirani lik sa dva režima. **Zašto:** Opacity ulaz postoji; nema rig-a, treptaja niti radničkog šlema.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `src/ui/aiFirst/AiAssistantArt.tsx:7`
**Predlog:** Zadržati originalan lik; posebno pripremiti izraze/pose, prvo48/88/128dp čitljivost. Ne deformisati PNG da glumi pisanje.
**Kasniji focused dokaz:** Listening samo dok mikrofon stvarno snima; thinking nije procenat; success samo receipt.
**Odobrenje:** Art i motion predlog odobriti; nova biblioteka nikad automatski. **Registar:** A02, B00, N01.

#### NAV01 · P1 odluka · IA / owner decision
**Problem:** Tri taba u novom uvodu naspram četiri u važećem kodu i odluci7.10. **Zašto:** Tiho uklanjanje Poruka gubi odobren ulaz; tiho zadržavanje ignoriše novu komandu.
**Dokaz:** SOURCE potvrđeno; nije native reprodukcija. `AGENTS.md:73`; `src/app/(app)/_layout.tsx:218`
**Predlog:** Pokazati3 (inbox u Dogovorima) i4 (postojeći zaseban Poruke). Preporuka4 za direktan razgovor, vlasnik odlučuje.
**Kasniji focused dokaz:** Svaki deep link i unread ulaz opstaje u obe skice.
**Odobrenje:** OBAVEZNA odluka vlasnika pre promene navigacije. **Registar:** A01, B04, D01, D03.

### 6. Blueprint svih62 poslovnih površina

Svaki red ispod je revizija predloga, ne nova potvrda funkcionalnosti. Svi primenjuju ugovor stanja S03; gde stanje nema smisla navesti N/A u kasnijem testu, ne izmišljati. Precizne statičke kontrole, slojevi i call-site linije za svaku rutu su u JSON inventaru. Svaki skraćeni naziv servisa ispod upućuje na postojeći src/data, ne na novi backend.

<a id="blueprint-a01"></a>
#### A01 · Početna: dve glavne radnje i šta čeka mene
- **Svrha/3 sekunde:** Razume šta danas traži odgovor i može odmah da započne obe namere.
- **Vrh→dno:** Znak/zvono/lice → dva velika ulaza → sledeći dogovoren termin ili najvažnije Čeka te → do3 kratka attention reda → moje liste/dostupnost.
- **Kontrole/glavna i sporedne radnje:** Dva ulaza, zvono, profil, tačan Dogovor, Moji zadaci, Moje prijave, dostupnost kad profil aktivan.
- **Slojevi/prijem/povratak/stanja:** Bez nove navigacije; nova osoba vidi kratko objašnjenje sa trajnim Sakrij na ovom uređaju. Vraćanje zadržava scroll.
- **Promena/predlog:** Čeka te ne sme biti KPI dashboard; jedan sledeći potez jači od ostalog.
- **Postojeći izvor:** `src/app/(app)/index.tsx` Servisi: `homeAttentionClientService`
- **Podaci/backend:** `rpc_home_attention`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: COM05, NAV01.

<a id="blueprint-a02"></a>
#### A02 · Razgovor sa AI: kaži šta treba
- **Svrha/3 sekunde:** Razgovor pretvara nameru u pregled, bez formulara preko celog četa.
- **Vrh→dno:** Back/naslov → kratka dobrodošlica robota → razgovor → jedna aktivna potvrda → završna kartica tek na kraju → composer.
- **Kontrole/glavna i sporedne radnje:** Tekst, mikrofon, dodaj sliku, izmeni sažetak, otvori mapu, potvrdi lokaciju, pregled.
- **Slojevi/prijem/povratak/stanja:** Sažetak disclosure; tastatura smanjuje dekoraciju; Back prvo editor/tastatura. Stare poruke ne skaču pri stream-u.
- **Promena/predlog:** Task terminalni composer već rešen; uskladiti worker, ne prepisivati engine.
- **Postojeći izvor:** `src/app/(app)/nova.tsx` Servisi: `aiNeedV2Production`
- **Podaci/backend:** `rpc_ai_open_need_conversation_owned_v2`, `uskoci-ai-interview`, `rpc_ai_read_need_turn_v2`, `rpc_ai_recover_need_turn_v2`, `rpc_ai_cancel_need_turn_v2`, `rpc_ai_need_review_v2`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: AI02, AI04, VIS01.

<a id="blueprint-a03"></a>
#### A03 · Glas u razgovoru
- **Svrha/3 sekunde:** Kaže zahtev glasom uz jasno stvarno stanje mikrofona.
- **Vrh→dno:** Isti composer → aktivan mikrofon/talas/vreme → transkript ili slanje po važećem režimu.
- **Kontrole/glavna i sporedne radnje:** Hold/release, otkaži snimanje, accessible tekst pregled, retry.
- **Slojevi/prijem/povratak/stanja:** Dozvola samo na nameru; odbijanje ostavlja tekst. Background prekida capture bez slanja tuđem nalogu.
- **Promena/predlog:** Animacija prati stvarni capture, ne lažni slušam.
- **Postojeći izvor:** `src/app/(app)/nova.tsx` Servisi: `useHoldToTalk`
- **Podaci/backend:** `uskoci-speech-session`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-a04"></a>
#### A04 · Mesto zadatka (tačka na mapi, adresa privatna)
- **Svrha/3 sekunde:** Potvrdi jedno tačno mesto bez zatrpavanja istorije.
- **Vrh→dno:** Pitanje o tački → mapa/pin → jedna adresa → Da, ovde / Nije tu.
- **Kontrole/glavna i sporedne radnje:** Expand, drag/tap pin, preciziraj adresu, potvrdi, otkaži.
- **Slojevi/prijem/povratak/stanja:** Full editor sa dirty draftom; reverse lookup fail ostavlja pin uz iskrenu oznaku. Posle potvrde kratak red Izmeni. Ruta čuva svaki slot.
- **Promena/predlog:** Ne dodavati200 izbora ni zelenih potvrda za svaku poruku; route overview ne glumi drumsku putanju.
- **Postojeći izvor:** `src/app/(app)/mesto-zadatka.tsx` Servisi: `locationClientService`
- **Podaci/backend:** `uskoci-location-search`, `rpc_save_need_location_review`, `rpc_get_need_location_review`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: AI03, AI04.

<a id="blueprint-a05"></a>
#### A05 · Fotografije zadatka
- **Svrha/3 sekunde:** Doda ili ukloni fotografiju uz pregled onoga što će biti javno.
- **Vrh→dno:** Naslov → fotografije grid → status pojedinačnog upload-a → dodaj → gotovo.
- **Kontrole/glavna i sporedne radnje:** Kamera/galerija, pregled, ukloni, retry, back.
- **Slojevi/prijem/povratak/stanja:** Dozvola→sistemski picker→preview; neuspešan upload nije uspešno objavljena fotografija.
- **Promena/predlog:** Veliki pregled na dodir, uredan kompaktan prilog u razgovoru.
- **Postojeći izvor:** `src/app/(app)/fotografije-zadatka.tsx` Servisi: `mediaClientService`
- **Podaci/backend:** `uskoci-media`, `rpc_read_task_photos`, `rpc_remove_task_photo`, `rpc_read_media_upload`, `rpc_cancel_media_upload`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: AI04.

<a id="blueprint-a06"></a>
#### A06 · Pregled pre objave
- **Svrha/3 sekunde:** Vidi tačno šta će drugi videti, a šta ostaje privatno.
- **Vrh→dno:** Javna TaskCard → javni detalj → jasno odvojeno Samo ti vidiš sa adresom/mapom → Objavi.
- **Kontrole/glavna i sporedne radnje:** Olovka svakog podatka, mapa, fotografije, objavi, nacrt; retko brisanje zasebno.
- **Slojevi/prijem/povratak/stanja:** Svaki editor vraća isti review; izmena invalidira prethodni frozen digest; pending/unknown posebni.
- **Promena/predlog:** Jedna kompozicija, ne dve različite task biblioteke. Privatna tačna adresa nikad u javnom bloku.
- **Postojeći izvor:** `src/app/(app)/pregled-zadatka.tsx` Servisi: `aiTaskReviewClientService`
- **Podaci/backend:** `rpc_prepare_ai_task_review`, `rpc_read_latest_ai_task_review`, `rpc_read_ai_task_review`, `rpc_ai_correct_fact_v2`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: AI03.

<a id="blueprint-a07"></a>
#### A07 · Objava zadatka
- **Svrha/3 sekunde:** Zna da je objava stvarno završena i nalazi svoj zadatak.
- **Vrh→dno:** Receipt potvrđen → naslov novog zadatka → otvori moj zadatak / postojeći map handoff.
- **Kontrole/glavna i sporedne radnje:** Objavi jedanput, Proveri kod neizvesnog ishoda, Otvori.
- **Slojevi/prijem/povratak/stanja:** Readback pre uspeha; vrati tačan ID; postojeći legacy publication landing ostaje namenski.
- **Promena/predlog:** Ne zahtevati automatski novi P6 put bez istog dokaza objave.
- **Postojeći izvor:** `src/app/(app)/pregled-zadatka.tsx` Servisi: `aiTaskReviewClientService`, `publicationClientService`
- **Podaci/backend:** `rpc_accept_ai_task_review`, `uskoci-publication-evaluate`, `rpc_publish_accepted_ai_task_review`, `rpc_get_need_publication_context`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-a08"></a>
#### A08 · Moj zadatak (detalj)
- **Svrha/3 sekunde:** Razume stanje svog zadatka i sledeći potez.
- **Vrh→dno:** Status+naslov → iznos → prijave/popuna → ključne činjenice → opis/mapa → vidljiva izmena/otkazivanje.
- **Kontrole/glavna i sporedne radnje:** Kandidati, pitanja, izmeni, zatvori potragu, otkaži; po server dozvolama.
- **Slojevi/prijem/povratak/stanja:** Draft/objavljeno/delimično popunjeno/zatvoreno imaju različit CTA. Back lista zadržava mesto.
- **Promena/predlog:** Status sažeti; manje instrukcijskih pasusa, publishedAt samo iz servera.
- **Postojeći izvor:** `src/app/(app)/potrebe/[id]/pregled.tsx` Servisi: `needClientService`
- **Podaci/backend:** `rpc_read_task`, `rpc_get_my_task_relations`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: TASK01.

<a id="blueprint-a09"></a>
#### A09 · Moji zadaci (lista)
- **Svrha/3 sekunde:** Brzo nalazi aktivan zadatak ili nacrt.
- **Vrh→dno:** Naslov → statusni segmenti sa tačnim brojevima → kompaktne kartice → sledeća strana.
- **Kontrole/glavna i sporedne radnje:** Otvori, nastavi nacrt, refresh, paging, filter.
- **Slojevi/prijem/povratak/stanja:** Cold skeleton, warm zadržano, error ponovi, prazno Objavi; ne brojati samo učitanu stranu kao total.
- **Promena/predlog:** Cena ispod naslova; najvažnija pažnja samo jednom.
- **Postojeći izvor:** `src/app/(app)/potrebe.tsx` Servisi: `needClientService`
- **Podaci/backend:** `rpc_list_my_tasks`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-a10"></a>
#### A10 · Pitanja o mom zadatku (odgovori)
- **Svrha/3 sekunde:** Odgovara na konkretno javno pitanje o zadatku.
- **Vrh→dno:** Naslov zadatka → pitanja/odgovori → aktivno pitanje → unos odgovora.
- **Kontrole/glavna i sporedne radnje:** Odgovori, starije, sigurnost gde dozvoljena, back.
- **Slojevi/prijem/povratak/stanja:** Slanje uz receipt; unknown proveri; nema privatne adrese u javnom odgovoru.
- **Promena/predlog:** Jedan thread ritam, ne kartica oko svake rečenice.
- **Postojeći izvor:** `src/app/(app)/pitanja-zadatka.tsx` Servisi: `preselectionQaClientService`
- **Podaci/backend:** `rpc_ru4b_owner_preselection_questions`, `rpc_ru4b_answer_preselection_question`, `rpc_ru4b_disposition_preselection_question`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-a11"></a>
#### A11 · Prijave i poređenje
- **Svrha/3 sekunde:** Poredi ponude po istim činjenicama i bira informisano.
- **Vrh→dno:** Zadatak → broj/sort samo kad tačan → kompaktni kandidati → izabrana2 za uporedi.
- **Kontrole/glavna i sporedne radnje:** Ponuda, profil, select2, poredi, odaberi.
- **Slojevi/prijem/povratak/stanja:** Offer/profile sheet; comparison čuva anchor; bez globalnog sort-a nad jednom stranom.
- **Promena/predlog:** Na361dp stvarne2kolone jednakih činjenica; ne dve ogromne kartice.
- **Postojeći izvor:** `src/app/(app)/potrebe/[id]/kandidati.tsx` Servisi: `candidateClientService`
- **Podaci/backend:** `rpc_list_need_candidates`, `rpc_mark_response_viewed`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: SEL01, SEL02, SEL03.

<a id="blueprint-a12"></a>
#### A12 · Izbor prijave → nastaje Dogovor
- **Svrha/3 sekunde:** Potvrđuje osobu i uslove uz jasan rezultat.
- **Vrh→dno:** Sažetak ponude/ljudi/iznos/termin → eksplicitna potvrda → Dogovoreno! → tačan Dogovor.
- **Kontrole/glavna i sporedne radnje:** Potvrdi izbor, odustani, proveri, otvori Dogovor.
- **Slojevi/prijem/povratak/stanja:** Revision/idempotency/readback; konkurentna promena vraća novu ponudu, ne automatski prihvat.
- **Promena/predlog:** Kratak brand moment posle receipt-a; ne zadržava navigaciju800ms.
- **Postojeći izvor:** `src/app/(app)/potrebe/[id]/kandidati.tsx` Servisi: `applicationSelectionClientService`
- **Podaci/backend:** `rpc_select_response`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-a13"></a>
#### A13 · Izmena objavljenog zadatka
- **Svrha/3 sekunde:** Menja zadatak uz svest o posledici za prijave.
- **Vrh→dno:** Važeći zadatak → izmene činjenica → pregled razlike → potvrda.
- **Kontrole/glavna i sporedne radnje:** Izmeni tekst/mesto/termin/uslove, pregledaj, potvrdi, otkaži draft.
- **Slojevi/prijem/povratak/stanja:** Back vraća original ako odbačeno; promenjene ponude zahtevaju odgovarajući lifecycle.
- **Promena/predlog:** AI završetak govori Izmene, nikad Objavi za već objavljen task.
- **Postojeći izvor:** `src/app/(app)/potrebe/[id]/pregled.tsx`, `src/app/(app)/pregled-zadatka.tsx` Servisi: `ru4Production`
- **Podaci/backend:** `rpc_ai_open_need_edit_conversation_v2`, `rpc_confirm_need_edit_from_review_v2`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: AI05.

<a id="blueprint-a14"></a>
#### A14 · Otkaži zadatak · obriši nacrt
- **Svrha/3 sekunde:** Razlikuje uklanjanje nacrta od otkazivanja javnog zadatka.
- **Vrh→dno:** Naziv → konkretna posledica → razlog kada potreban → destruktivna potvrda.
- **Kontrole/glavna i sporedne radnje:** Otkaži ili obriši prema stanju, nazad, proveri.
- **Slojevi/prijem/povratak/stanja:** Kratak center dialog; duži razlog/review sheet; nepoznat rezultat se ne ponavlja novim ID.
- **Promena/predlog:** Jasna crvena samo na potvrdi i posledici; česta radnja dostupna na detalju.
- **Postojeći izvor:** `src/app/(app)/potrebe/[id]/pregled.tsx` Servisi: `needLifecycleClientService`
- **Podaci/backend:** `rpc_cancel_need`, `rpc_delete_draft_need`, `rpc_get_need_lifecycle_receipt`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-a15"></a>
#### A15 · Zatvori preostalu potragu
- **Svrha/3 sekunde:** Zatvara samo preostalu potragu uz očuvanje postojećih Dogovora.
- **Vrh→dno:** Koliko ljudi je već dogovoreno → šta se zatvara → potvrda.
- **Kontrole/glavna i sporedne radnje:** Zatvori potragu, odustani, otvori postojeće Dogovore.
- **Slojevi/prijem/povratak/stanja:** Server dozvola; ne mešati sa otkazivanjem svih Dogovora.
- **Promena/predlog:** Jedna nedvosmislena rečenica posledice, bez šireg destruktivnog naziva.
- **Postojeći izvor:** `src/app/(app)/potrebe/[id]/pregled.tsx` Servisi: `ru4Production`
- **Podaci/backend:** `rpc_close_remaining_search`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-a16"></a>
#### A16 · Uključi HITNO za svoj zadatak
- **Svrha/3 sekunde:** Zna postoji li stvarna mogućnost HITNO.
- **Vrh→dno:** Danas skriveno/onemogućeno prema server politici; buduća posebna specifikacija tek posle odobrenja.
- **Kontrole/glavna i sporedne radnje:** Ne prikazivati aktivno dugme za neaktivnu funkciju.
- **Slojevi/prijem/povratak/stanja:** DEV urgent_activation_policy=false; nema tajnog countdown-a, plaćanja ni pusha.
- **Promena/predlog:** Odvojiti dekorativnu oznaku od stvarnog dispatch-a; ne izmisliti SLA.
- **Postojeći izvor:** `src/app/(app)/potrebe/[id]/pregled.tsx` Servisi: `urgentActivationClientService`
- **Podaci/backend:** `rpc_urgent_activation_preview`, `rpc_activate_urgent`, `fn_need_urgency`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-b00"></a>
#### B00 · Radni profil kroz razgovor sa AI
- **Svrha/3 sekunde:** Kroz razgovor sastavlja radni profil koji posle pregleda hrani stvarne servise.
- **Vrh→dno:** Naslov → robot/kratko pitanje → šta ume → gde/kada/oprema po potrebi → sažetak → pregled.
- **Kontrole/glavna i sporedne radnje:** Tekst/glas prema postojećem režimu, izmeni činjenicu, područje, pregled, sačuvaj.
- **Slojevi/prijem/povratak/stanja:** Poznato ime ne pita ponovo; draft nije live profil; završeni thread ima Otvori radni profil.
- **Promena/predlog:** Isti jezik kao task AI, različita pitanja; bez tehničkog RS unosa.
- **Postojeći izvor:** `src/app/(app)/profil/razgovor.tsx` Servisi: `workerAiClientService`
- **Podaci/backend:** `rpc_open_worker_ai`, `uskoci-worker-interview`, `rpc_read_worker_ai`, `rpc_patch_worker_ai`, `rpc_prepare_worker_ai_review`, `rpc_save_worker_ai_review`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: AI01, AI02, AI06, VIS01.

<a id="blueprint-b01"></a>
#### B01 · Lični radni profil — pregled i izmene
- **Svrha/3 sekunde:** Razume kako se predstavlja i da li je radni profil aktivan.
- **Vrh→dno:** Identitet → status profila → veštine/opis → gde/kada → oprema → izmene.
- **Kontrole/glavna i sporedne radnje:** AI dopuni, ručno izmeni, javni pregled, aktiviraj/deaktiviraj prema ugovoru.
- **Slojevi/prijem/povratak/stanja:** Pregled čuva draft/digest; sačuvano tek posle receipt-a.
- **Promena/predlog:** Oprema vidljiva, ali ne obećava matching kriterijum koji nije odobren.
- **Postojeći izvor:** `src/app/(app)/profil/radnik.tsx` Servisi: `workerProfileClientService`, `workerCapacityClientService`
- **Podaci/backend:** `rpc_get_worker_profile_for_edit`, `rpc_save_worker_capacity`, `rpc_get_worker_capacity`, `rpc_complete_worker_profile`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-b02"></a>
#### B02 · Područje rada
- **Svrha/3 sekunde:** Odredi stvarno područje rada razumljivim mestom.
- **Vrh→dno:** Grad/područje → predlog na mapi → radijus kad smislen → sačuvaj.
- **Kontrole/glavna i sporedne radnje:** Pretraga, geolokacija na zahtev, mapa, radijus, sačuvaj.
- **Slojevi/prijem/povratak/stanja:** Bez dozvole može ručno; ne uzimati trenutni GPS kao trajni grad bez potvrde.
- **Promena/predlog:** Grad→deo oblasti, ne privatna adresa svakog radnika.
- **Postojeći izvor:** `src/app/(app)/profil/lokacija.tsx` Servisi: `locationClientService`, `marketClientService`
- **Podaci/backend:** `rpc_get_worker_location`, `rpc_save_worker_location`, `rpc_list_location_markets`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: AI06.

<a id="blueprint-b03"></a>
#### B03 · Dostupnost
- **Svrha/3 sekunde:** Odredi kada može da uskoči.
- **Vrh→dno:** Trenutno dostupno → nedeljni raspored → izuzeci ako postoje → sačuvaj.
- **Kontrole/glavna i sporedne radnje:** Toggle, izbor dana/vremena, pregled, sačuvaj, odbaci.
- **Slojevi/prijem/povratak/stanja:** Dirty Back; nema implicitnog obećanja HITNO iz Mogu odmah.
- **Promena/predlog:** Vreme poznato/nenavedeno nisu isto; Raspored Dogovora nije editor dostupnosti.
- **Postojeći izvor:** `src/app/(app)/profil/dostupnost.tsx` Servisi: `workerAvailabilityClientService`
- **Podaci/backend:** `rpc_get_worker_availability`, `rpc_save_worker_availability`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-b04"></a>
#### B04 · Mapa i lista prilika
- **Svrha/3 sekunde:** Pronalazi relevantne zadatke u oblasti ili van mape.
- **Vrh→dno:** Jedinstvena mapa+search/filter+chips → compact/peek/half/full sheet → tabovi prema visini.
- **Kontrole/glavna i sporedne radnje:** Pin, cluster, locate, pan/zoom, Na daljinu, Za mene, Danas, Nisu na mapi, mapa/full, detalj.
- **Slojevi/prijem/povratak/stanja:** Attribution prati isti sheet; Back peek→compact/full→half po modelu; viewport/filter/scroll se vraćaju.
- **Promena/predlog:** Remote prvo; nema cena na svakoj tački; jedan source of truth i bounded pinless.
- **Postojeći izvor:** `src/app/(app)/mapa.tsx`, `src/app/(app)/prilike.tsx`, `src/app/(app)/zadaci.tsx` Servisi: `supabaseIzvor`, `marketplaceView`
- **Podaci/backend:** `rpc_list_open_tasks_v3`, `rpc_get_my_task_relations`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: D01, D03, D04, D05, D07, D08, D09, D10, D11, NAV01.

<a id="blueprint-b05"></a>
#### B05 · Pretraga i filteri
- **Svrha/3 sekunde:** Nalazi predmet i mesto pa sužava uslove.
- **Vrh→dno:** Search odvojen od filtera; full-screen tekst + lokacija + recent; filter sheet Kada/Gde/Iznos.
- **Kontrole/glavna i sporedne radnje:** Šta/gde, recent clear, ceo grad/deo, primeni, očisti, filter count/retry.
- **Slojevi/prijem/povratak/stanja:** Draft ne menja rezultate pre primene; recent brisanje pri odjavi; keyboard back prvo.
- **Promena/predlog:** Tri ponuđene varijante, preporuka potvrda→FULL lista; owner bira.
- **Postojeći izvor:** `src/app/(app)/prilike.tsx`, `src/app/(app)/zadaci.tsx` Servisi: `marketplaceView`
- **Podaci/backend:** `NOVO: udaljenost i sortiranje`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: D01, D02, D03, D04, D06.

<a id="blueprint-b06"></a>
#### B06 · Detalj prilike
- **Svrha/3 sekunde:** Odlučuje da li ga zadatak zanima i da li može da se prijavi.
- **Vrh→dno:** Naslov/cena → ključne činjenice → osoba → opis/uslovi → javna približna mapa → jedna prijava.
- **Kontrole/glavna i sporedne radnje:** Ponuda/prijava po ceni, pitanje, profil, slika, mapa, share/safety.
- **Slojevi/prijem/povratak/stanja:** Own/applied/selected/unknown imaju različit CTA; exact adresa ne postoji u javnoj projekciji.
- **Promena/predlog:** Detalj nije uvećana list kartica; sekcije bez kutije oko svake.
- **Postojeći izvor:** `src/app/(app)/prilike/[id].tsx` Servisi: `needClientService`
- **Podaci/backend:** `rpc_read_task`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: D11, AI03.

<a id="blueprint-b07"></a>
#### B07 · Postavi pitanje pre ponude
- **Svrha/3 sekunde:** Dobije pojašnjenje pre ponude.
- **Vrh→dno:** Kratak task kontekst → postojeća pitanja → unos.
- **Kontrole/glavna i sporedne radnje:** Pošalji pitanje, otvori odgovore, back.
- **Slojevi/prijem/povratak/stanja:** Ne duplirati privatni chat; javno pitanje jasno označeno.
- **Promena/predlog:** Pitanja blizu uslova, ne novu glavnu karticu na vrhu.
- **Postojeći izvor:** `src/app/(app)/prilike/[id].tsx` Servisi: `preselectionQaClientService`, `qaSubmissionClientService`
- **Podaci/backend:** `rpc_ru4b_public_preselection_qa`, `uskoci-qa-classify`, `rpc_read_qa_classification`, `rpc_cancel_qa_classification`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-b08"></a>
#### B08 · Javni profil i ugled
- **Svrha/3 sekunde:** Proceni osobu na osnovu stvarnih podataka.
- **Vrh→dno:** Ime/lice → dostupna reputacija → javni opis → dozvoljene ocene.
- **Kontrole/glavna i sporedne radnje:** Otvori komentar ocene gde ugovor dozvoljava, nazad, prijavi/blokiraj.
- **Slojevi/prijem/povratak/stanja:** OWN_ONLY i COMMENTED_ONLY iz DEV-a poštovati; nema izmišljene verifikacije/procenta.
- **Promena/predlog:** Poverenje kroz dokazive činjenice; prazna ocena nije0zvezdica.
- **Postojeći izvor:** `src/app/(app)/prilike/[id].tsx` Servisi: `publicProfileClientService`
- **Podaci/backend:** `rpc_get_public_profile`, `rpc_get_account_reputation`, `rpc_read_safety_target`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-b09"></a>
#### B09 · Pošalji ponudu
- **Svrha/3 sekunde:** Predloži jasan ukupan iznos i termin.
- **Vrh→dno:** Task summary → ukupno → ljudi → termin → opciona poruka → pregled → pošalji.
- **Kontrole/glavna i sporedne radnje:** Polja, time sheet, pregled, slanje, odustani.
- **Slojevi/prijem/povratak/stanja:** Fixed iznos nije edit; idempotent send→nova označena Moja prijava.
- **Promena/predlog:** Jasno ukupno za sve ljude; nema skrivenog množenja ili finansijske funkcije.
- **Postojeći izvor:** `src/app/(app)/prilike/[id]/prijava.tsx` Servisi: `applicationClientService`
- **Podaci/backend:** `rpc_submit_response`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-b10"></a>
#### B10 · Moje prijave
- **Svrha/3 sekunde:** Vidi odgovor na svaku svoju prijavu i ulazi u Dogovor.
- **Vrh→dno:** Statusi → kompaktni redovi naslov/iznos/termin/status → paging.
- **Kontrole/glavna i sporedne radnje:** Detalj, tačan Dogovor za izabranu, izmeni/povuci gde dozvoljeno.
- **Slojevi/prijem/povratak/stanja:** Pending/selected/rejected/withdrawn nisu samo boje; ukupni brojevi iz ugovora.
- **Promena/predlog:** Čeka odgovor i čeka tvoju potvrdu odvojeni.
- **Postojeći izvor:** `src/app/(app)/moje-prijave.tsx` Servisi: `myApplicationsClientService`
- **Podaci/backend:** `rpc_list_my_applications`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-b11"></a>
#### B11 · Izmeni ili povuci ponudu
- **Svrha/3 sekunde:** Ispravlja/povlači svoju ponudu bez gubitka važeće verzije.
- **Vrh→dno:** Trenutna ponuda → promena ili posledica povlačenja → pregled/confirm.
- **Kontrole/glavna i sporedne radnje:** Izmeni, povuci, odustani, proveri.
- **Slojevi/prijem/povratak/stanja:** Revision conflict vraća nove uslove; ne bira drugi Dogovor po naslovu.
- **Promena/predlog:** Destruktivno povlačenje odvojeno od obične izmene.
- **Postojeći izvor:** `src/app/(app)/moje-prijave.tsx`, `src/app/(app)/prilike/[id]/prijava.tsx` Servisi: `applicationClientService`, `ru4Production`
- **Podaci/backend:** `rpc_submit_response`, `rpc_withdraw_response`, `rpc_resolve_stale_response_after_need_edit`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-b12"></a>
#### B12 · Raspored (kalendar posla)
- **Svrha/3 sekunde:** Vidi dogovorene termine i njihove praznine.
- **Vrh→dno:** Mesec/Nedelja/Dan → izabrani datum → stvarni Dogovori → bez termina.
- **Kontrole/glavna i sporedne radnje:** Danas, prethodni/sledeći, swipe, režim, otvori Dogovor, arhiva.
- **Slojevi/prijem/povratak/stanja:** Isti datum pri promeni režima; nepoznat izvor nije slobodan dan; loose appointments ostaju dostupni.
- **Promena/predlog:** Kalendar služi obavezama; ne uvesti novi scheduler bez servera.
- **Postojeći izvor:** `src/app/(app)/raspored.tsx` Servisi: `workerCalendarClientService`
- **Podaci/backend:** `rpc_get_worker_calendar`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: COM05.

<a id="blueprint-d01"></a>
#### D01 · Lista Dogovora
- **Svrha/3 sekunde:** Vidi sa kim sarađuje i šta od njega zavisi.
- **Vrh→dno:** Aktivni/Istorija → čeka tebe → dogovoreni termini → ostali → arhiva.
- **Kontrole/glavna i sporedne radnje:** Otvori, poruke, oceni gde due, Raspored, segment/refresh.
- **Slojevi/prijem/povratak/stanja:** Preserve scroll/status; pending cancel/change dominira samo gde menja sledeću radnju.
- **Promena/predlog:** Kompaktni redovi; iznos+termin+lice, jedna statusna poruka, bez ogromnih kartica.
- **Postojeći izvor:** `src/app/(app)/dogovori.tsx` Servisi: `agreementClientService`
- **Podaci/backend:** `rpc_list_my_agreements_page`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: UX01, NAV01.

<a id="blueprint-d02"></a>
#### D02 · Dogovor: pregled, uslovi, sledeći korak
- **Svrha/3 sekunde:** Za3sekunde vidi ko/šta/kada/koliko i sledeću radnju.
- **Vrh→dno:** Osoba+task → Pregled/Poruke → status/next action → vreme/iznos/lokacija → uslovi → vidljive sporedne radnje.
- **Kontrole/glavna i sporedne radnje:** Poruke, izmena, problem, otkazivanje, task/application, safety.
- **Slojevi/prijem/povratak/stanja:** Autoritativne capabilities; privatno zaklonjeno pri resume dok read nije validan.
- **Promena/predlog:** Dogovor kao aktivna saradnja; istoriju koraka disclosure, ne timeline preko pola ekrana.
- **Postojeći izvor:** `src/app/dogovor/[id].tsx` Servisi: `agreementClientService`
- **Podaci/backend:** `rpc_get_agreement_workspace`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: UX01.

<a id="blueprint-d03"></a>
#### D03 · Poruke
- **Svrha/3 sekunde:** Čita i šalje poruke u pravom Dogovoru.
- **Vrh→dno:** Inbox: lice/ime/vreme/poruka/task. Thread: kompaktan kontekst → poruke → composer.
- **Kontrole/glavna i sporedne radnje:** Text/photo/voice, starije, latest, retry/proveri, task kontekst, inbox status.
- **Slojevi/prijem/povratak/stanja:** Read samo vidljivo; targeted message deep link; account change clears state; starije čuvaju anchor.
- **Promena/predlog:** Ne mešati sve task razgovore iste osobe; unread1:1 ne izmišljati.
- **Postojeći izvor:** `src/app/dogovor/[id].tsx`, `src/app/(app)/poruke.tsx` Servisi: `agreementMessageClientService`, `agreementMessageHistoryService`, `agreementHistoryModel`, `conversationInboxClientService`
- **Podaci/backend:** `rpc_send_agreement_message_v2`, `rpc_read_agreement_messages_page_v1`, `rpc_mark_displayed_agreement_messages_v1`, `rpc_read_agreement_message_window_v1`, `rpc_list_my_conversations_v1`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: COM04, COM05, COM06, NAV01.

<a id="blueprint-d04"></a>
#### D04 · Slike u porukama
- **Svrha/3 sekunde:** Razmeni dozvoljenu sliku unutar saradnje.
- **Vrh→dno:** Picker → preview → upload state → message bubble → full viewer.
- **Kontrole/glavna i sporedne radnje:** Izaberi, otkaži, pošalji, retry, fullscreen, zatvori.
- **Slojevi/prijem/povratak/stanja:** Potpisani URL istek čitljiv recovery; bez public bucket pretpostavke.
- **Promena/predlog:** Isti outbox lifecycle kao tekst; layout rezerviše sliku da lista ne skače.
- **Postojeći izvor:** `src/app/dogovor/[id].tsx` Servisi: `agreementPhotoClientService`
- **Podaci/backend:** `uskoci-media`, `rpc_send_agreement_photo_message_v5`, `rpc_read_agreement_photo_messages_v5`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-d05"></a>
#### D05 · Grupni razgovor (više ljudi)
- **Svrha/3 sekunde:** Koordinira više učesnika uz očuvanu privatnost pojedinačnih Dogovora.
- **Vrh→dno:** Naziv grupe/task → poruke → unos; učesnici u sheet-u.
- **Kontrole/glavna i sporedne radnje:** Tekst, starije, članovi, relevantni Dogovor za requester, safety.
- **Slojevi/prijem/povratak/stanja:** Text-only ostaje; background čuva memory draft; incoming refresh; sent vraća READY.
- **Promena/predlog:** Ukloniti policy pasus iz stalne istorije, smisao sačuvati u informacijama.
- **Postojeći izvor:** `src/app/dogovor/[id]/grupa.tsx` Servisi: `groupConversationService`
- **Podaci/backend:** `rpc_read_group_context_v5`, `rpc_send_group_message_v5`, `rpc_read_group_messages_v5`, `rpc_mark_group_messages_read_v5`, `rpc_read_group_command_v5`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: COM01, COM02, COM03, UX02.

<a id="blueprint-d06"></a>
#### D06 · Izmene Dogovora (predlog, prihvati, odbij, povuci)
- **Svrha/3 sekunde:** Razume šta druga strana menja i može da odgovori.
- **Vrh→dno:** Važeće→predloženo za promenjena polja → razlog → prihvati/odbij ili povuci.
- **Kontrole/glavna i sporedne radnje:** Predloži, pregledaj, prihvati/odbij/povuci po ulozi.
- **Slojevi/prijem/povratak/stanja:** Ne prepisivati važeći ugovor pre prihvatanja; pending i conflict posebno.
- **Promena/predlog:** Vizuelni diff samo promenjenih polja, ostala u disclosure.
- **Postojeći izvor:** `src/app/dogovor/[id]/izmene.tsx` Servisi: `agreementClientService`
- **Podaci/backend:** `rpc_propose_agreement_change_v2`, `rpc_respond_agreement_change`, `rpc_withdraw_agreement_change`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-d07"></a>
#### D07 · Otkaži Dogovor uz razlog
- **Svrha/3 sekunde:** Zna posledicu otkazivanja pre potvrde.
- **Vrh→dno:** Task+osoba → razlog → posledica → otkaži Dogovor.
- **Kontrole/glavna i sporedne radnje:** Razlog, review, confirm, back, check.
- **Slojevi/prijem/povratak/stanja:** Destruktivni CTA crven; receipt→status i poruke, ne nestanak bez objašnjenja.
- **Promena/predlog:** Bez opšteg Da/Ne dijaloga bez imena radnje.
- **Postojeći izvor:** `src/app/dogovor/[id]/izmene.tsx` Servisi: `agreementClientService`
- **Podaci/backend:** `rpc_cancel_agreement`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-d08"></a>
#### D08 · Kontakt i tačna adresa zadatka u Dogovoru
- **Svrha/3 sekunde:** Dođe do mesta i kontakta kad ima pravo pristupa.
- **Vrh→dno:** Mesto → tačna ili približna oznaka → mapa/tačke → navigacija/kontakt.
- **Kontrole/glavna i sporedne radnje:** Expand mapa, otvori maps, telefon po capability, back.
- **Slojevi/prijem/povratak/stanja:** Sakrivanje pri auth/revalidation, ne u public cache/log/share. Ruta otvara celu navigaciju.
- **Promena/predlog:** Privacy oznaka mala ali nedvosmislena; ne prikazivati tačan pin svima.
- **Postojeći izvor:** `src/app/dogovor/[id].tsx` Servisi: `contactClientService`
- **Podaci/backend:** `rpc_reveal_contact`, `rpc_set_contact_grant`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: AI03.

<a id="blueprint-d09"></a>
#### D09 · Prijavi problem u Dogovoru
- **Svrha/3 sekunde:** Prijavi konkretnu prepreku iz saradnje.
- **Vrh→dno:** Kontekst → vrsta/tekst/dokaz → pregled → pošalji.
- **Kontrole/glavna i sporedne radnje:** Izaberi razlog, dodaj dokaz gde postoji, confirm, support link.
- **Slojevi/prijem/povratak/stanja:** Prijava problema nije automatski raskid; receipt jasno stanje.
- **Promena/predlog:** Komanda vidljiva u Pregledu; upozorenje opisuje šta dalje.
- **Postojeći izvor:** `src/app/dogovor/[id].tsx` Servisi: `agreementClientService`
- **Podaci/backend:** `rpc_report_problem`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-d10"></a>
#### D10 · Završio sam (strana koja radi)
- **Svrha/3 sekunde:** Javi da je zadatak završen bez lažne finalnosti.
- **Vrh→dno:** Task+osoba → potvrdi završio sam → čeka potvrdu druge strane.
- **Kontrole/glavna i sporedne radnje:** Zadatak je gotov, odustani, proveri.
- **Slojevi/prijem/povratak/stanja:** Server response menja status; ne automatska ocena pre confirm.
- **Promena/predlog:** Success ton miran, label Čeka potvrdu, ne Završen.
- **Postojeći izvor:** `src/app/dogovor/[id].tsx` Servisi: `agreementClientService`
- **Podaci/backend:** `rpc_mark_work_done`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-d11"></a>
#### D11 · Potvrdi završetak (i automatsko završavanje)
- **Svrha/3 sekunde:** Potvrdi rezultat ili prijavi problem.
- **Vrh→dno:** Task → ko traži potvrdu → potvrdi / problem → ocena kad dozvoljena.
- **Kontrole/glavna i sporedne radnje:** Potvrdi, problem, detalj, proveri.
- **Slojevi/prijem/povratak/stanja:** Automatski rok samo serverski; lokalni sat ne zatvara Dogovor.
- **Promena/predlog:** Jedna zelena radnja, problem vidljiv sporedan red.
- **Postojeći izvor:** `src/app/dogovor/[id].tsx` Servisi: `agreementClientService`
- **Podaci/backend:** `rpc_confirm_completion`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-d12"></a>
#### D12 · Ocena
- **Svrha/3 sekunde:** Oceni stvarnu saradnju bez napornog formulara.
- **Vrh→dno:** Lice+task → zvezdice sa imenovanim izborom → opcioni tag/komentar → pošalji.
- **Kontrole/glavna i sporedne radnje:** Ocena, komentar, save, back.
- **Slojevi/prijem/povratak/stanja:** Due eligibility, existing review, expired/unknown; ne obećavati anonimnost.
- **Promena/predlog:** Nema mandatory duge poruke; potvrda tek nakon receipt-a.
- **Postojeći izvor:** `src/app/(app)/oceni-dogovor.tsx` Servisi: `reviewsClientService`
- **Podaci/backend:** `rpc_submit_agreement_review`, `rpc_get_my_agreement_review`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-d13"></a>
#### D13 · Koraci napretka Dogovora
- **Svrha/3 sekunde:** Razume gde je saradnja stigla.
- **Vrh→dno:** Trenutno stanje + sledeći korak → detaljna istorija na dodir.
- **Kontrole/glavna i sporedne radnje:** Proširi korake, relevantna radnja.
- **Slojevi/prijem/povratak/stanja:** Razlikovati završio/čeka/potvrđeno/ocenjeno, ne sve zelene tačke.
- **Promena/predlog:** Timeline sekundaran, naročito pri velikom tekstu.
- **Postojeći izvor:** `src/app/dogovor/[id].tsx`
- **Podaci/backend:** Postojeći session/UI ugovor; ne dodavati novu bazu za izgled.
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-p01"></a>
#### P01 · Obaveštenja u aplikaciji (zvonce)
- **Svrha/3 sekunde:** Odmah razume događaj i na koji zadatak se odnosi.
- **Vrh→dno:** Naslov/zupčanik → filteri → danas/ranije → kratki red događaj/task/vreme.
- **Kontrole/glavna i sporedne radnje:** Otvori target, mark read swipe+accessible, mark all, paging.
- **Slojevi/prijem/povratak/stanja:** Invalid target/removed entity daju recovery, unread tekst+dot; nema replay animacije stare istorije.
- **Promena/predlog:** Task title vodi; isti rowCopy za govor i vizuelni tekst.
- **Postojeći izvor:** `src/app/obavestenja.tsx` Servisi: `inboxClientService`
- **Podaci/backend:** `rpc_list_inbox`, `rpc_mark_inbox_read`, `rpc_resolve_activity_event`, `rpc_mark_activity_event_read`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: COM06, A11Y01.

<a id="blueprint-p02"></a>
#### P02 · Podešavanja obaveštenja
- **Svrha/3 sekunde:** Kontroliše šta stiže i kada, razume šta ne zavisi od toggle-a.
- **Vrh→dno:** Stanje ovog telefona → Moji zadaci/Moje prijave → grupe događaja → tihi sati → napredno → sačuvaj.
- **Kontrole/glavna i sporedne radnje:** Toggle, time pickers, device actions, save dirty.
- **Slojevi/prijem/povratak/stanja:** OS dozvola, binding i backend spremnost tri odvojene stvari; UNKNOWN nije uključeno.
- **Promena/predlog:** Skraćena objašnjenja u disclosure; ne menjati značenje preferenci.
- **Postojeći izvor:** `src/app/(app)/profil/obavestenja.tsx` Servisi: `notificationPreferencesClientService`
- **Podaci/backend:** `rpc_get_notification_preferences`, `rpc_set_notification_preferences`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-p03"></a>
#### P03 · Registracija telefona za obaveštenja
- **Svrha/3 sekunde:** Poveže baš ovaj telefon za obaveštenja uz jasnu dozvolu.
- **Vrh→dno:** Trenutno stanje → razlog traženja → sistemska dozvola → potvrđena veza.
- **Kontrole/glavna i sporedne radnje:** Poveži, otvori postavke ako odbijeno, ukloni vezu uz potvrdu.
- **Slojevi/prijem/povratak/stanja:** Dozvola odbijena ostavlja inbox; server upis/binding i test push samo uz vlasnikovu reč.
- **Promena/predlog:** Nema zelene uspostavljeno dok receipt nije potvrđen.
- **Postojeći izvor:** `src/app/(app)/profil/obavestenja.tsx` Servisi: `pushDeviceClientService`, `nativePushDevice`
- **Podaci/backend:** `rpc_set_push_device_owned`, `rpc_get_push_device_owned`, `rpc_rotate_push_device_owned`, `rpc_revoke_push_session`, `rpc_get_push_session_device`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-p04"></a>
#### P04 · Slanje obaveštenja na telefon
- **Svrha/3 sekunde:** Poruka sa uređaja vodi na pravi sadržaj.
- **Vrh→dno:** Nema novog ekrana: OS notification → auth/recovery gate → tačan task/agreement/message.
- **Kontrole/glavna i sporedne radnje:** Tap, eventualni retry destination.
- **Slojevi/prijem/povratak/stanja:** Cold/warm/background, ugašene dozvole, više uređaja, token churn; ne tvrditi isporučeno iz queued.
- **Promena/predlog:** PUSH-KAPACITET pripremljen, nije dozvola slanja.
- **Postojeći izvor:** Servisni tok, bez samostalne rute.
- **Podaci/backend:** `uskoci-push-transport`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-p05"></a>
#### P05 · Podsetnik pred termin
- **Svrha/3 sekunde:** Dobije pravovremen i tačan podsetnik o postojećem terminu.
- **Vrh→dno:** Notification sadržaj sa potvrđenim terminom → konkretan Dogovor.
- **Kontrole/glavna i sporedne radnje:** Otvori, preference.
- **Slojevi/prijem/povratak/stanja:** Rok i quiet hours server-authoritative; izmenjen/otkazan termin ne šalje star podsetnik.
- **Promena/predlog:** Nema lažnog countdown-a ako politika nije uključena.
- **Postojeći izvor:** Servisni tok, bez samostalne rute.
- **Podaci/backend:** `NOVO: podsetnik pred dogovoreni termin`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-n01"></a>
#### N01 · Prijava
- **Svrha/3 sekunde:** Uđe bez zabune između prijave i registracije.
- **Vrh→dno:** Postojeći brand entry → Prijavi se/Registruj se → jedna jasna forma.
- **Kontrole/glavna i sporedne radnje:** Email/password, vidi lozinku, prijava, oporavak, registracija.
- **Slojevi/prijem/povratak/stanja:** Keyboard/focus, pending, neutralna auth greška; return destination se čuva bez tokena u URL-u.
- **Promena/predlog:** Originalna animacija ne blokira ponovljeni ulaz; ne praviti novi auth sistem.
- **Postojeći izvor:** `src/app/auth.tsx` Servisi: `authClientService`
- **Podaci/backend:** Postojeći session/UI ugovor; ne dodavati novu bazu za izgled.
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: VIS01.

<a id="blueprint-n02"></a>
#### N02 · Registracija i potvrda emaila
- **Svrha/3 sekunde:** Napravi nalog i zna da li treba potvrda emaila.
- **Vrh→dno:** Ime/email/lozinka i potrebno mesto → registruj → proveri email → resend.
- **Kontrole/glavna i sporedne radnje:** Polja, pokaži lozinku, potvrda, resend sa stvarnim ograničenjem.
- **Slojevi/prijem/povratak/stanja:** Link pending/expired/used, validacija; jedno ime svuda.
- **Promena/predlog:** Kratko objašnjenje namene podatka; ne tražiti godine bez potrebe.
- **Postojeći izvor:** `src/app/auth.tsx` Servisi: `authClientService`
- **Podaci/backend:** Postojeći session/UI ugovor; ne dodavati novu bazu za izgled.
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-n03"></a>
#### N03 · Oporavak lozinke
- **Svrha/3 sekunde:** Povrati pristup bez otkrivanja da li nalog postoji.
- **Vrh→dno:** Email → neutralna potvrda → validiran link → nova lozinka.
- **Kontrole/glavna i sporedne radnje:** Pošalji link, resend, nova lozinka, back.
- **Slojevi/prijem/povratak/stanja:** Expired/invalid link vraća recovery; token ne logovati ni ostaviti u ruti.
- **Promena/predlog:** Zadržati postojeći bezbedni callback, skratiti tekst bez menjanja poruke.
- **Postojeći izvor:** `src/app/auth.tsx`, `src/app/oporavak.tsx` Servisi: `passwordRecoveryClientService`
- **Podaci/backend:** Postojeći session/UI ugovor; ne dodavati novu bazu za izgled.
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-n04"></a>
#### N04 · Pravna dokumenta i saglasnost
- **Svrha/3 sekunde:** Pročita stvarne važeće dokumente i razume saglasnost.
- **Vrh→dno:** Lista dokumenata/verzije → dokument → potvrda pregledanog gde potrebna.
- **Kontrole/glavna i sporedne radnje:** Otvori, pročitaj, prihvati, nazad.
- **Slojevi/prijem/povratak/stanja:** Nedostupno nije prihvaćeno; operator podaci/pravni tekstovi ne izmišljati.
- **Promena/predlog:** Čista tipografija, veći lineheight, logika nije samo dizajn.
- **Postojeći izvor:** `src/app/(app)/profil/pravna.tsx` Servisi: `legalClientService`
- **Podaci/backend:** `rpc_get_legal_bundle`, `rpc_accept_reviewed_legal_bundle`, `rpc_read_my_legal_acceptance`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-n05"></a>
#### N05 · Moji podaci i slika profila
- **Svrha/3 sekunde:** Menja lične podatke na jednom mestu.
- **Vrh→dno:** Profil hub→lični podaci: slika/ime/opis; područje na svom editoru.
- **Kontrole/glavna i sporedne radnje:** Crop/upload/remove, ime, sačuvaj, retry usklađivanja radnog imena.
- **Slojevi/prijem/povratak/stanja:** Dirty Back, upload fail, receipt, jedno ime; slika u krugu.
- **Promena/predlog:** Profil hub kompozicija kraća, postojeće ispravke fotografije ne prijaviti kao nove bez dokaza.
- **Postojeći izvor:** `src/app/(app)/profil/fotografija.tsx`, `src/app/(app)/profil/podaci.tsx` Servisi: `requesterProfileClientService`, `mediaClientService`
- **Podaci/backend:** `rpc_get_requester_profile_for_edit`, `rpc_save_requester_profile`, `rpc_apply_profile_avatar`, `rpc_read_profile_avatar`, `rpc_clear_profile_avatar`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: IA01.

<a id="blueprint-n06"></a>
#### N06 · Blokiranje osobe
- **Svrha/3 sekunde:** Zaustavi kontakt i vidi koga je blokirao.
- **Vrh→dno:** Osoba → posledice → blokiraj; lista blokiranih → odblokiraj confirm.
- **Kontrole/glavna i sporedne radnje:** Block/unblock, report, nazad.
- **Slojevi/prijem/povratak/stanja:** Svoj/nepoznat target nema komandu; blokada ne znači brisanje Dogovora.
- **Promena/predlog:** Jednostavan red sa imenom i posledicom, bez dekorativne ilustracije preko upozorenja.
- **Postojeći izvor:** `src/app/(app)/bezbednost.tsx`, `src/app/(app)/profil/blokirani.tsx` Servisi: `safetyClientService`
- **Podaci/backend:** `rpc_set_account_block`, `rpc_list_my_account_blocks`, `rpc_get_account_block`, `rpc_read_safety_target`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: IA01.

<a id="blueprint-n07"></a>
#### N07 · Prijava osobe ili sadržaja
- **Svrha/3 sekunde:** Prijavi tačan sadržaj/osobu uz kontekst.
- **Vrh→dno:** Vrsta+target → razlog → tekst/dokaz → pregled → pošalji.
- **Kontrole/glavna i sporedne radnje:** Izbor razloga, unos, confirm, cancel.
- **Slojevi/prijem/povratak/stanja:** Sadržaj reference i privatnost sačuvani; unknown proveri.
- **Promena/predlog:** Ne duplirati support form za istu nameru; predpopunjen kontekst.
- **Postojeći izvor:** `src/app/(app)/bezbednost.tsx` Servisi: `safetyClientService`
- **Podaci/backend:** `rpc_submit_safety_report`, `rpc_read_my_safety_report_command`, `rpc_read_safety_target`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-n08"></a>
#### N08 · Podrška
- **Svrha/3 sekunde:** Traži pomoć i prati odgovor o svom predmetu.
- **Vrh→dno:** Moji predmeti → detalj razgovora/stanja → odgovori; novi predmet sa kontekstom.
- **Kontrole/glavna i sporedne radnje:** New, reply, history, appeal gde available, operator samo uz capability.
- **Slojevi/prijem/povratak/stanja:** Receipt/recovery, paging događaja, read-on-visible tek posle dokaza.
- **Promena/predlog:** Korisnik vidi poruke i sledeći potez, operator posebne kontrole.
- **Postojeći izvor:** `src/app/(app)/podrska/index.tsx`, `src/app/(app)/podrska/[id].tsx`, `src/app/(app)/podrska/novi.tsx`, `src/app/(app)/podrska/operator.tsx` Servisi: `supportCaseClientService`
- **Podaci/backend:** `rpc_support_submit_v5`, `rpc_support_detail_v5`, `rpc_support_capabilities_v5`, `rpc_support_inbox_v5`, `rpc_support_find_context_v5`, `rpc_support_mark_read_v5`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: UX02.

<a id="blueprint-n09"></a>
#### N09 · Izvoz mojih podataka
- **Svrha/3 sekunde:** Preuzme svoje podatke ili vidi zašto još čeka.
- **Vrh→dno:** Status izvoza → jedna aktuelna radnja → detalji istorije niže.
- **Kontrole/glavna i sporedne radnje:** Zatraži, proveri, preuzmi, otkaži/opozovi gde dozvoljeno.
- **Slojevi/prijem/povratak/stanja:** Generisanje/istek/unknown/failed odvojeno; validacija hash/rok/generation ostaje.
- **Promena/predlog:** Ne izmišljati procenat pripreme ni trajanje.
- **Postojeći izvor:** `src/app/(app)/profil/izvoz.tsx` Servisi: `dataExportClientService`
- **Podaci/backend:** `rpc_request_data_export`, `rpc_get_data_export_status`, `rpc_cancel_data_export`, `rpc_revoke_data_export_download`, `uskoci-data-export-worker`, `uskoci-data-export-download`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: IA01.

<a id="blueprint-n10"></a>
#### N10 · Brisanje naloga
- **Svrha/3 sekunde:** Razume prepreke i posledice trajnog zatvaranja naloga.
- **Vrh→dno:** Privatnost→obriši → blockers/retention → eksplicitna potvrda → processing/recovery.
- **Kontrole/glavna i sporedne radnje:** Pripremi, pregledaj blockers, potvrdi, proveri, cancel samo gde dozvoljeno.
- **Slojevi/prijem/povratak/stanja:** Nije obrisano dok server ne potvrdi; sesija/recovery ne rušiti radi dizajna.
- **Promena/predlog:** Bez robota koji slavi brisanje; čist miran destruktivni tok.
- **Postojeći izvor:** `src/app/(app)/profil/privatnost.tsx` Servisi: `closureExecutionClientService`, `accountClosureClientService`
- **Podaci/backend:** `rpc_prepare_account_closure`, `rpc_start_account_closure_execution`, `rpc_read_account_closure_execution`, `rpc_get_account_closure`, `uskoci-account-closure-worker`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-n11"></a>
#### N11 · Privatnost i čuvanje podataka
- **Svrha/3 sekunde:** Razume ko vidi podatke i gde upravlja njima.
- **Vrh→dno:** Vidljivost → čuvanje podataka disclosure → izvoz/blokirani/pravila → brisanje.
- **Kontrole/glavna i sporedne radnje:** Otvori svaki deo, nazad, closure.
- **Slojevi/prijem/povratak/stanja:** Server OWN_ONLY/COMMENTED_ONLY i pravna zadržavanja prikazati tačno, bez novih toggle-a.
- **Promena/predlog:** Jedan dom za privatnost, ne kopija cele liste i u profilu.
- **Postojeći izvor:** `src/app/(app)/profil/privatnost.tsx` Servisi: `retentionPolicyClientService`, `processorMapClientService`
- **Podaci/backend:** `rpc_get_retention_policy_status`, `rpc_get_processor_map_status`
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Dodatni kriterijumi: IA01.

<a id="blueprint-s01"></a>
#### S01 · Vraćanje prijave pri pokretanju
- **Svrha/3 sekunde:** Vrati se tamo gde sme bez slučajnog otkrivanja privatnog sadržaja.
- **Vrh→dno:** Neutralno pokretanje → auth gate → dozvoljen prethodni ekran.
- **Kontrole/glavna i sporedne radnje:** Ponovi/session recovery kad potrebno.
- **Slojevi/prijem/povratak/stanja:** Account revision, stale callbacks, foreground conceal; splash ne čeka animaciju ako podaci spremni.
- **Promena/predlog:** Skeleton prati konačan layout; ne logotip pet puta.
- **Postojeći izvor:** `src/app/(app)/index.tsx` Servisi: `supabaseClient`
- **Podaci/backend:** Postojeći session/UI ugovor; ne dodavati novu bazu za izgled.
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-s02"></a>
#### S02 · Dva naloga na jednom telefonu (A→B→A)
- **Svrha/3 sekunde:** Promeni nalog bez tragova prethodnog korisnika.
- **Vrh→dno:** Odjava potvrda → auth → novi account.
- **Kontrole/glavna i sporedne radnje:** Odjava, prijava, back prema sesiji.
- **Slojevi/prijem/povratak/stanja:** Obavezno očisti recent search, private cache, drafts, media references; push binding spec zaseban.
- **Promena/predlog:** Ne čuvati istu mapu privatnih tačaka ili draft nalogaA uB.
- **Postojeći izvor:** `src/app/auth.tsx` Servisi: `authClientService`
- **Podaci/backend:** Postojeći session/UI ugovor; ne dodavati novu bazu za izgled.
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-s03"></a>
#### S03 · Pozadina, bez mreže, dupli dodir
- **Svrha/3 sekunde:** Može da nastavi posle prekida bez duplih akcija.
- **Vrh→dno:** Postojeći sadržaj → diskretno stanje veze → ista radnja/recovery.
- **Kontrole/glavna i sporedne radnje:** Retry istog id, Proveri unknown, back safe, refresh.
- **Slojevi/prijem/povratak/stanja:** Cold/warm/offline/partial/pending/unknown/confirmed jasno odvojeni.
- **Promena/predlog:** Živost dolazi iz kontinuiteta, ne iz beskrajnog spinner-a.
- **Postojeći izvor:** Servisni tok, bez samostalne rute. Servisi: `serverReceipt`
- **Podaci/backend:** Postojeći session/UI ugovor; ne dodavati novu bazu za izgled.
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

<a id="blueprint-s04"></a>
#### S04 · Stare serverske verzije (čišćenje)
- **Svrha/3 sekunde:** Održavanje ne uklanja aktivnu zavisnost zbog broja verzije.
- **Vrh→dno:** Nema korisničkog ekrana; dependency+call graph → proof→revert→owner approval.
- **Kontrole/glavna i sporedne radnje:** RETIRE-V1 samo po pripremljenom paketu.
- **Slojevi/prijem/povratak/stanja:** AI confirm v1/correctv2 nisu sami po sebi bug; indirect Edge callers proveriti.
- **Promena/predlog:** KEEP aktivne ugovore; REMOVE samo dokazano mrtvo, bez DEV mutacije u auditu.
- **Postojeći izvor:** Servisni tok, bez samostalne rute.
- **Podaci/backend:** Postojeći session/UI ugovor; ne dodavati novu bazu za izgled.
- **Kasniji test:** cold/popunjeno/prazno gde smisleno, error/retry, pending/unknown kod komande, keyboard+Back,1.15/1.3font; jedna konkretna radnja iz ovog reda sa pravim readback-om, bez vlasnikovog poslovnog upisa. Nema novog potvrđenog propusta u ovom auditu; to nije all-pass.

### 7. Dodatne rute, sistemski slojevi i stanja

| Ruta | Klasifikacija | Ulazni fajl |
|---|---|---|
| `/` | production entry | `src/app/(app)/index.tsx` |
| `/arhiva` | production entry | `src/app/(app)/arhiva.tsx` |
| `/auth` | production entry | `src/app/auth.tsx` |
| `/bezbednost` | production entry | `src/app/(app)/bezbednost.tsx` |
| `/dogovor/[id]` | production entry | `src/app/dogovor/[id].tsx` |
| `/dogovor/[id]/grupa` | production entry | `src/app/dogovor/[id]/grupa.tsx` |
| `/dogovor/[id]/izmene` | production entry | `src/app/dogovor/[id]/izmene.tsx` |
| `/dogovori` | production entry | `src/app/(app)/dogovori.tsx` |
| `/fotografije-zadatka` | production entry | `src/app/(app)/fotografije-zadatka.tsx` |
| `/mapa` | redirect | `src/app/(app)/mapa.tsx` |
| `/mesto-zadatka` | production entry | `src/app/(app)/mesto-zadatka.tsx` |
| `/moje-aktivnosti` | redirect | `src/app/(app)/moje-aktivnosti.tsx` |
| `/moje-prijave` | production entry | `src/app/(app)/moje-prijave.tsx` |
| `/nova` | production entry | `src/app/(app)/nova.tsx` |
| `/obavestenja` | production entry | `src/app/obavestenja.tsx` |
| `/oceni-dogovor` | production entry | `src/app/(app)/oceni-dogovor.tsx` |
| `/oporavak` | production entry | `src/app/oporavak.tsx` |
| `/pitanja-zadatka` | production entry | `src/app/(app)/pitanja-zadatka.tsx` |
| `/podrska` | production entry | `src/app/(app)/podrska/index.tsx` |
| `/podrska/[id]` | production entry | `src/app/(app)/podrska/[id].tsx` |
| `/podrska/novi` | production entry | `src/app/(app)/podrska/novi.tsx` |
| `/podrska/operator` | conditional operator | `src/app/(app)/podrska/operator.tsx` |
| `/poruke` | production entry | `src/app/(app)/poruke.tsx` |
| `/potrebe` | production entry | `src/app/(app)/potrebe.tsx` |
| `/potrebe/[id]/kandidati` | production entry | `src/app/(app)/potrebe/[id]/kandidati.tsx` |
| `/potrebe/[id]/pregled` | production entry | `src/app/(app)/potrebe/[id]/pregled.tsx` |
| `/pregled-nacrta` | redirect | `src/app/(app)/pregled-nacrta.tsx` |
| `/pregled-zadatka` | production entry | `src/app/(app)/pregled-zadatka.tsx` |
| `/prijave` | redirect | `src/app/prijave.tsx` |
| `/prilike` | redirect | `src/app/(app)/prilike.tsx` |
| `/prilike/[id]` | production entry | `src/app/(app)/prilike/[id].tsx` |
| `/prilike/[id]/prijava` | production entry | `src/app/(app)/prilike/[id]/prijava.tsx` |
| `/profil` | production entry | `src/app/(app)/profil.tsx` |
| `/profil/blokirani` | production entry | `src/app/(app)/profil/blokirani.tsx` |
| `/profil/dostupnost` | production entry | `src/app/(app)/profil/dostupnost.tsx` |
| `/profil/fotografija` | production entry | `src/app/(app)/profil/fotografija.tsx` |
| `/profil/izvoz` | production entry | `src/app/(app)/profil/izvoz.tsx` |
| `/profil/lokacija` | production entry | `src/app/(app)/profil/lokacija.tsx` |
| `/profil/lozinka` | production entry | `src/app/(app)/profil/lozinka.tsx` |
| `/profil/o-aplikaciji` | production entry | `src/app/(app)/profil/o-aplikaciji.tsx` |
| `/profil/obavestenja` | production entry | `src/app/(app)/profil/obavestenja.tsx` |
| `/profil/ocene` | production entry | `src/app/(app)/profil/ocene.tsx` |
| `/profil/podaci` | production entry | `src/app/(app)/profil/podaci.tsx` |
| `/profil/pravna` | production entry | `src/app/(app)/profil/pravna.tsx` |
| `/profil/prijava-greske` | production entry | `src/app/(app)/profil/prijava-greske.tsx` |
| `/profil/privatnost` | production entry | `src/app/(app)/profil/privatnost.tsx` |
| `/profil/radnik` | production entry | `src/app/(app)/profil/radnik.tsx` |
| `/profil/razgovor` | production entry | `src/app/(app)/profil/razgovor.tsx` |
| `/raspored` | production entry | `src/app/(app)/raspored.tsx` |
| `/zadaci` | production entry | `src/app/(app)/zadaci.tsx` |

Redirect-i /mapa,/prilike,/moje-aktivnosti i stari ulazi nisu novi proizvodni ekrani. /arhiva je istorija rasporeda, /pregled-nacrta vraćanje sačuvanog nacrta. /profil/lozinka: sadašnja/nova/ponovljena lozinka→Save uz inline grešku, bez dekoracije. /profil/o-aplikaciji: stvarna verzija i pravni/pomoć linkovi. /profil/prijava-greske: contextual support forma sa pregledom podataka koje šalje. /podrska/operator samo capability; ne crtati ga običnom korisniku. +native-intent nije ekran, nego security-sensitive callback granica. Dizajn-laboratorijske rute su isključene iz produkcionog broja; ne služе kao dokaz produkcionih click putanja.

| Sloj | Kompozicija/close | Stanja i povratak |
|---|---|---|
| Kratka potvrda |Center dialog:naslov posledice,kratko telo,odustani/konkretna radnja |Android Back odustaje pre send;pending ne glumi cancel server komande |
| Jedan podatak |Bottom sheet:naslov/polje/validacija/save |Dirty potvrda,keyboard-safe footer,restore focus |
| Pretraga |Full screen predlogB;vođeniC samo alternativa |Back keyboard prvo,recent logout,query draft čuva do odustajanja |
| Filter |Sectioned sheet,primeni broj,očišti |Preview loading/retry,atomic apply,no draft leakage |
| Datum/vreme |Isti postojeći time editor,zavisno od polja |No invented time,Serbia24h,invalid range inline |
| Velika mapa |Full screen,map-first,adresa+confirm |Point draft odvojen od potvrđenog;permission fail ručno |
| Kandidat/profil |Offer sheet;profil zaseban dozvoljen detalj |Back po sloju;ne preklopiti dva footer-a |
| Gallery/media |Fullscreen image + close,composer preview pre send |Failed/expired URL recovery;private bytes scoped |
| Group members |Sheet ime/uloga i dozvoljeni dogovor |Ne izložiti tuđe privatne ugovore |
| Izmene/otkazivanje |Review razlike/posledice;duga forma screen |Revision conflict,unknown check;server capability |
| Privacy/export/delete |Status+jedna current radnja;retention disclosure |Pending≠done;blockers vidljivi;istek linka recovery |
| Permissions |Sistemski dialog tek na zahtev;pre objašnjenje svrhe |Odbijeno:alternativni tekst/ručna lokacija/inbox;ne beskrajan prompt |
| Overflow |Samo retko:share/safety/info |Česte edit/cancel nikad jedino tu |

### 8. Šest disciplinarnih revizija i korigovan predlog

| Perspektiva (simulirana stručna kritika) | Rizik prvog predloga | Korekcija pre predaje |
|---|---|---|
| Product |Sve odjednom na Home;novi izmišljeni KPI/verification |Dva ulaza+jedna sledeća radnja;postojeća istina bez izmišljenog match procenta |
| UX/IA |Dupli privacy izlazi;tri/four tabu konflikt |Jedan privacy dom;obe nav skice;bez tihog uklanjanja Poruka |
| Visual/brand |Svaka stvar card,svaka akcija artwork |Task card gde se bira zapis;settings/agreements redovi;artwork samo značajne činjenice |
| Motion |Previše hero robota i duga animacija pre radnje |Jedan welcome;no blocking;stari rezultati bez replay;reduced motion fallback |
| Engineering/performance |Filter u telefonu izgleda globalan;pinless iscrpljuje istoriju |Bounded reads,server totals/scopes,retain snapshot;bez zaključka o3k concurrent iz single-backend screeninga |
| Independent UX/QA |Skica idealnih podataka maskira stale/unknown/largefont |Posebne recovery skice i tačan native acceptance plan;stari phone screenshot nije novi PASS |

Ovo nisu šest stvarnih nezavisnih ljudskih recenzenata. Tri odvojena SOURCE subreview-a su pokrila Discovery, AI/task i Dogovore/account; root je povezao zaključke i primenio šest perspektiva.

### 9. KEEP / IMPROVE / RECOMPOSE / REMOVE

| KEEP | IMPROVE | RECOMPOSE | REMOVE samo posle dokaza |
|---|---|---|---|
| RPC/RLS/revision/idempotency;P6 owner/epochs;publication landing;warm restore;one name;sys;original art;calendar3modes |Worker terminal;group continuity;inbox scope;city drill;peek totals;spoken labels;retry |Home pažnja;dva AI sažetka;Dogovor lista/detail;profil/privacy;search B ili vlasnikov izbor |Dupli UI linkovi gde jedan dom dovoljan;tehnički pasusi prebačeni u info;neiskorišćeni RPC samo RETIRE-V1 proof+revert+approval |

Ne brisati v1 samo zbog naziva, ne izbacivati source/test sa drugačijeg branch-a, ne kopirati candidates SQL naslepo u migracije. Reproduktivnost sveže baze zaseban dokaz, nije zaključena brojanjem foldera.

### 10. Redosled kasnije implementacije i granice

1. Vlasnik bira search/nav i odobrava konkretne skice. Nema app izmene u ovom paketu.
2. Najmanji coherent paket:worker terminal + AI kompozicija/lokacija (postojeći engine);preview/public-detail ista projekcija.
3. Discovery city/apply/remote order/peek total/error retention. Pinless bounded client pa po potrebi poseban server paket. Ne otvoriti P6 zbog samog audita.
4. Group draft/incoming/receipt continuity;inbox lifecycle/unread ugovor uz odobrenje. Kandidati2comparison+offset.
5. Home/agreements/profile/settings po usvojenim kompozicijama;calendar/notifications/privacy iste primitives.
6. Robot asset/motion posebni mali paket nakon što su tokovi čitljivi. Nova biblioteka samo uz dozvolu.
7. B server iz handoffa:RETIRE-V1,publishedAt,sort,unread,PUSH-KAPACITET,Edge copy,HITNO — svaki ima svoj preflight/revert/approval. Dizajn prihvaćen ne znači server odobren.
8. C cleanup/D release po postojećoj listi;prodavnica/pravo/plaćanje ne mogu postati READY na osnovu lepe skice.

### 11. Kriterijumi kasnije provere tačnog APK-a

- Identifikuj source SHA, APK hash/version/package/signing;USKOCI_V5_TEST1264×2728/560dpi/font1.15/EuropeBelgrade. Telefon samo vlasnikova reč i install-r,bez brisanja/logout/upisa sa njegovog naloga.
- Svaka promenjena porodica:normal1.0 za kompoziciju,1.15 glavni cilj,1.3 resilience;361dp uska širina;keyboard,Back,drag,rotation samo ako app podržava. TalkBack čitanje i48dp ciljevi.
- Vizuelno:pored source-a slika svake promene,dug naslov,bez slike/ocene/iznosa,6 različitih statusa;ne svim redovima isti mock status.
- Stanja:cold empty/loaded,partial read,error,offline,refresh retention,pagination exhausted,permission denied,unknown after send,confirmed after readback. Native business writes samo test nalozi uz dozvolu.
- Motion:kratak video pin→Peek,half→full,Back,keyboard,AI map collapse;stills ne dokazuju fluidnost. Meriti ciljeve feedback≤100ms,pin≤200ms,Back≤350ms sa metodom/start/end/frame intervalom i ponavljanjima,ne relaksirati brojke.
- Ne uzimati link URL kao dokaz izcrtane drumske rute,queued kao delivered,published bundle kao installed,active Edge kao provereno izvršenje,simulaciju kao PHONE.

### 12. Primarni istraživački izvori i granice

- [Android navigation](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns):3–5 glavnih odredišta i logički grupisane sekundarne radnje. To dozvoljava obe USKOČI varijante;ne odlučuje umesto vlasnika.
- [Android accessibility](https://developer.android.com/guide/topics/ui/accessibility/apps):48dp targets,tekstualni kontrast4.5:1 standardni/3:1 veliki,razumljive oznake. Palette sama nije dokaz svih rendered kontrasta.
- [Airbnb2025 release](https://news.airbnb.com/product-releases/airbnb-2025-summer-release):objedinjen kontekst putovanja i razgovora;za USKOČI princip je jedan Dogovor/jedna jasna sledeća radnja,ne kopiranje putovanja/kategorija.
- [Uber Base Web](https://www.uber.com/us/en/blog/introducing-base-web/):jedna osnova komponenti. Princip podržava konsolidaciju sys,ne dodavanje web biblioteke u RN.
- R1–R4 i AIRBNB spec su inspiracija/propozicije,ne dokaz aktuelnog koda. Nisu prihvaćene izmišljene trust značke,match%,Imaš kombi kao matching razlog,cena desno protiv kasnije odluke,ni tvrdnja da Dogovoreno sada ne postoji.
- Apple motion stranica i Base aktualni sajt nisu dali čitljiv kompletan sadržaj u ovom pregledu;ne pripisujemo im ovde neproverena tačna trajanja. Nisu rađeni live user journey-i konkurentskih aplikacija.

### 13. Predaja

**URADIO:** source inventar i semantički audit,live DEV metadata,revizija postojećeg nacrta/centralnog dokumenta/62-row registra,konkretne skice. **DOKAZAO:** navedene code putanje i DEV235/digest;ne novo runtime ponašanje. **NIJE DOKAZANO:** novi APK,PHONE/FPS/whole E2E/3k concurrent/production release. **SLEDEĆE:** vlasnikov izbor prikazanih ekrana,pa odvojen odobren implementacioni paket.

**NO APPLICATION SOURCE CODE, SERVER, CI, DEVICE OR PRODUCTION STATE WAS MODIFIED BY THIS DESIGN AUDIT.** Dokumentacija i njene lokalne projekcije jesu ažurirane;ovo nije tvrdnja da je checkout nepromenjen.

### 14. Dokaz dokumentacionog paketa i ograničenje prikaza

58 ilustrativnih ekrana/stanja u lokalnoj HTML galeriji. Statička provera JavaScript sintakse,izvršenja šablona bez browsera,svih ciljnih skica i lokalnih artwork/font putanja: PASS;0 nedostajućih veza,0 nedostajućih slika. To nije vizuelni PASS: ugrađeni browser je blokirao file:// URL bezbednosnim pravilom. Nije korišćen drugi browser,HTTP posrednik niti zaobilaženje;raspored i animacije nisu renderovani/provereni u ovom krugu. Vlasnik može otvoriti lokalni HTML za pregled.

Tri pretrage su zasebne kompozicije A/B/C. Prekidač3/4taba pokazuje oba ulaza u Poruke. Tri stilska pravca u bočnom panelu su umerene varijante iste postojeće porodice,ne tri zasebne UI biblioteke. Nisu generisani novi roboti niti novi logo. Postojeće slike koriste se uz originalne proporcije.

Svih 71 RPC imena iz direktnih source poziva pronađeno je u DEV katalogu. Širi inventar sadrži 170 doslovnih rpc_/fn_ simbola, uključujući pozive kroz wrappers: ni među njima nema imena odsutnog iz proveravanog kataloga. Inventarisani su i handler-i kontrola i gesture/Back/lifecycle reference. To nije dokaz aktivne dostupnosti svake funkcije u tačnom APK-u; feature flag-ovi, potpisi, grant/auth behavior i izvršenje ostaju odvojeni.

Lokalne projekcije registra su obnovljene postojećim generatorima; LIVE provera doslednosti 62 reda prolazi. Prethodna stanja svih redova ostala su ista: 41 „PROBLEM“ i 21 „NA TELEFONU NIJE PROVERENO“. To su zbirne oznake registra, ne tvrdnja da postoje 41 nova greška. Nijedan novi telefonski dokaz nije dodat. Nema diff-a u `src/`, `supabase/`, paketima, workflow-ima ili `eas.json`. Promenjena je dokumentacija. Objavljena Claude tabla nije sinhronizovana ovim paketom; lokalna tabla jeste.


<a id="revizija2-20261008"></a>
## 15. Revizija 2 — kompozicija, orijentacija i uvođenje korisnika

**Povod:** vlasnik je pregledao HTML i tražio navigaciju na HALF/FULL, jasnije lične liste i Dogovore, više smislenih kapsula, ravnopravan „Za mene“ i filtere van mape, kratka objašnjenja i motion. Traži slobodno osmišljavanje korisnijih ekrana celog proizvoda. **Ovo je revizija predloga; nema promene aplikacije, servera ni telefona.** Raniji §14 beleži prvu verziju; sada je u istoj galeriji 78 prikaza, uključujući osam povezanih ilustrativnih detalja — to nisu 78 novih produkcionih ekrana.

### 15.1 Šta je ova provera stvarno utvrdila

SOURCE baseline ove revizije: `e6a9713c` (prethodni docs fix), poslovni source ostao isti kao u prvom auditu. Obnovljeno ciljano čitanje Discovery i ličnih radnih lista, entry/onboarding i motion tokena, uz dva nezavisna read-only agentska pregleda. Nije ponovljena fizička provera svih 50 route entry fajlova ili svih 697 modula; kompletan prethodni inventar i 62 blueprint-a iznad ostaju ulaz.

1. **HALF/FULL navigacija postoji u app kodu**, ali HALF nije bio prikazan u HTML-u. `src/ui/v2/DiscoveryPresentation.tsx:688–691`, `src/ui/v2/discovery/zadaciBar.ts`, `sheetSnaps.ts`. Nije potvrđen kvar navigacije u APK-u. Ispravlja se nepotpun dizajnerski primer.
2. **Remote već zadržava „Za mene“ i negeografske uslove.** `src/data/marketplaceView.ts:293`, `src/data/discoveryV1MarketplaceAdapter.ts:33–47`. Prvi HTML je to loše predstavio. Ne izmišljati novo uparivanje samo da bi se nacrtala kapsula.
3. **Off-map nije isto što i remote.** `DiscoveryPresentation.tsx:176–182,376–380,1188–1193`: lokalni lens + automatsko dočitavanje. Za skaliranje ostaje zaseban paged scope zahvat; nije zaključak da ceo Discovery backend ne radi.
4. **Prijave menjaju organizaciju tokom paginacije.** `src/ui/v2/MyApplicationsPresentation.tsx:61,93–108`: dok postoji hasMore pokazuje čipove i ravnu listu; po završetku čitanja prelazi na grupe. `src/data/myApplicationsView.ts:10` svrstava SELECTED u finished ako nema attention, dok applicationGroup pravi posebnu selected grupu. To može biti namerna završena prijava, ali ne znači završen posao. UI mora razlikovati ta značenja i imati stabilne kontrole.
5. **Lične liste već imaju vrednu semantiku.** `ownTaskPhases.ts`, `agreementListModel.ts`, `AgreementCollectionPresentation.tsx`: Čeka tvoj izbor, Objavljeno, Dogovoreno, danas/sutra/nedelja/bez termina. Sačuvati kapacitete i vremenske grupe; ne proglasiti sadašnje liste praznim placeholder-om.
6. **Logo intro i preskakanje već postoje.** `src/ui/entry/EntryWelcome.tsx`, `src/hooks/useEntryIntro.ts`. Predložena edukacija je drugi sloj; ne ponovo graditi logo animaciju. Per-feature dismissed/seen pravilo nije dokazano kao gotov jedinstveni sistem.

### 15.2 Discovery kao jedan prostor

| Stanje | Navigacija | Pretraga i uslovi | Korisnikov sledeći korak |
|---|---|---|---|
| COMPACT | Sakrivena | Search i zaseban Filteri na vrhu mape; stabilan red kapsula | Pin ili podigni listu; „Nisu na mapi“ vidljiv u traci |
| HALF | Vidljiva, poslednji red liste ne sme ispod nje | Vrh mape ostaje; isti primenjeni uslovi | Skrol liste ili povlačenje za FULL |
| FULL | Vidljiva | Pretraga preuzima vrh lista, bez duplog polja ili mrtve trake mape | Čitaj rezultate, promeni uslove, vrati mapu |
| PEEK | Sakrivena prema već postojećoj vlasnikovoj odluci | Jedna kartica izabranog pina na dnu | Detalj ili zatvori; bez dve konkurentne liste |
| Remote / off-map | Vidljiva | Isti relevantni tekst, Za mene, termin, ponude/iznos, Filteri | Izbor zadatka; povratak na sačuvanu mapu |

U galeriji se ručica povlači mišem/dodirom; dodir podiže za jedan nivo, strelica spušta. Nav prati nivo. Escape u HTML-u spušta jedan nivo. **Predlog za Android Back** je isti postepeni niz FULL→HALF→COMPACT→izlaz, uz prioritet tastature/panela/kartice; to je promena prema sadašnjem FULL→compact i HALF route back, zato zahteva potvrdu pre implementacije. Dugme „Mapa“ može direktno u COMPACT. Sheet i tabovi dele jedan progress; nema dva nezavisna tajmera. Povlačenje tokom kretanja preuzima postojeću poziciju. Native velocity/spring/gesture takeover nisu dokazani HTML kodom.

Map state mora čuvati query, geografski scope, kameru, detent, scroll i selected task ID. Otvaranje detalja ne resetuje te podatke. Cluster zumira oblast, a ne otvara nasumičan task. Promena filtera uklanja selection samo ako stvarno izađe iz skupa. Stari snapshot može ostati dok stigne novi rezultat, uz jasan status osvežavanja. Broj nije broj samo trenutno učitanih kartica ako UI tvrdi globalni total.

Kapsule nisu katalog kategorija. Predlog stabilnog reda: **Na daljinu · Za mene · Danas · Ovaj vikend · Sa iznosom**. Područje i dodatni aktivni uslovi dolaze zatim; Filteri ostaju jasno posebno dugme. Na daljinu je ulaz u scope, Za mene je personalizacija, Danas/vikend vremenski uslov, Sa iznosom isključuje nepoznatu cenu. Danas i vikend se međusobno isključuju. Kapsule mogu horizontalno da se pomeraju, ali ključni ulaz ne nestaje zbog umetanja aktivnih uslova ispred njega. Datum se računa u produktnoj zoni, ne nagađa po stringu kao u ilustrativnom HTML-u.

Nema HITNO kapsule dok politika nije aktivna; nema „proveren“, „95% poklapanje“ ili „najbolje plaćeni“ bez podataka. Ako Za mene nema spreman radni profil, pokaži Dovrši profil / Prikaži sve, ne lažno praznu bazu. Prikaz Za mene na remote-u koristi postojeći server ugovor; off-map pagination popravka ima odvojeno odobrenje ako menja DEV.

**Van mape:** podizbor Svi / Na daljinu / Bez pina. „Bez pina“ nije „nema adresu“ i ne dokazuje da lokacija ne postoji: znači da nema precizne javne tačke u ovom prikazu. Privatna adresa se ne izvlači da bi se popunila mapa. Remote ne prikazuje nebitnu geografsku etiketu Novi Sad, a povratak vraća ranije geografske uslove. Galerija pretražuje i filtrira samo osam eksplicitno izmišljenih primera; mapa i kartica istog primera dele ID.

### 15.3 Lični rad: preporuka i alternative

**A — preporuka: jedan radni prostor, tri stalna pogleda.** Za skicu postojeći glavni naziv **Dogovori**, sa podtabovima Dogovori / Moji zadaci / Moje prijave. Ispod: kratka pretraga, filteri specifični za taj pogled, diskretan redosled i Raspored. Jedan kompaktan red po zapisu, direktan ulaz u detalj, vidljiva akcija samo kada čeka korisnika. Isti zadatak može postojati kao objava i imati više Dogovora: ne sabirati ih kao isti posao, ne duplirati u jednoj ravnoj listi bez vrste zapisa.

**Pitanje imena za odobrenje:** ako Dogovori sadrže i nacrte/prijave, naziv može biti preuzak. Alternativni naziv „Moje“ ili „Moj rad“ može biti jasniji, ali nije usvojen. Tri glavna taba su početni prikaz po poslednjem uvodu vlasnika; četvrti Poruke ostaje samo opcija poređenja u HTML-u. Ne menjati produkcionu navigaciju na osnovu skice.

**B — najmanja promena navike:** Dogovori ostaju samo saradnje; tri postojeće liste dobijaju iste prelaze Moji zadaci / Moje prijave / Dogovori i ostaju dostupne iz Početne. U HTML-u „Alternativa · povezane postojeće liste“. Prednost je manja promena, mana više odvojenih odredišta i potreba da Back jasno vrati prethodni kontekst.

**C — sve po sledećoj radnji:** jedan pregled Čeka tebe → Sledeći termin → Čekaš odgovor, uz vidljivu vrstu zapisa. U HTML-u „Alternativa · po sledećoj radnji“. Brzo za više poslova, ali slabije za nalaženje konkretnog nacrta/prijave i lako duplira Početnu. Preporuka: takav sažetak na Home, ne još jedan novi glavni tab. Podela samo po dve uloge razmatrana je i odbačena za glavni radni prostor jer razdvaja saradnje istog čoveka na dva mesta.

| Pogled | Statusi/filtriranje | Red sadržaja | Izvor i ograničenje |
|---|---|---|---|
| Moji zadaci | Svi, čeka izbor/ima prijava, aktivni, nacrti, istorija | Naslov → prijave/pokrivenost → termin → sledeća radnja | ownTasksPage ima ALL/ACTIVE/DRAFTS/HISTORY/WAITING. Objavljen nije završen Dogovor. „Ima prijava“ nije automatski isto što i server WAITING. |
| Moje prijave | Svi, čeka moju radnju, čeka odgovor, izabrane, završene prijave | Naslov → moja ponuda → ko čeka koga → Dogovor ako postoji | FILTER.SELECTED kao zaseban globalni skup prvo usaglasiti sa readerom; ne filtrirati samo prvu stranu |
| Dogovori | Aktivni, čeka mene, istorija; tamo završeni/otkazani | Zadatak → osoba → potvrđen termin → iznos/status → konkretna akcija | agreementListModel i capabilities; završeno koje čeka ocenu ostaje u radu |
| Raspored | Mesec/Nedelja/Dan; bez termina odvojeno | Vreme → zadatak/osoba → Dogovor | Koristiti prihvaćen termin Dogovora, ne zastareli termin prvobitne objave |
| Poruke | Razgovori sa zadatkom i osobom, grupa jasno označena | Osoba/grupa → poslednja poruka → zadatak → vreme | Nepročitano samo iz pravog read-state; nikad iz broja Dogovora |

**Redosled nije samo ukrasni dropdown.** Galerija prikazuje primere Prvo čeka mene / Najnovije / Naziv A–Š za poređenje. Pre aplikacije: reader mora dati isti globalni sort i cursor. PublishedAt koji još nije projektovan ne sme se zameniti createdAt uz etiketu „objavljeno“. Server term/cena/uloga filtriranje nije automatski postojeće. `ownTasksRefined` može učitati sve redove kod pretrage/cene: ne proširivati taj obrazac. Na izvoru i adapteru proveriti značenje, sigurnu granicu i false-empty scenario pre ugradnje.

Status kod nije cela UX poruka. **Čeka tebe** nosi konkretnu radnju i mali narandžasti akcenat. **Čekaš odgovor** je neutralno čekanje. **Izabrana** vodi na tačan Dogovor. **Završena prijava** ne govori da je posao završen. **Završen Dogovor** može još čekati ocenu. **Otkazano** ima razumljiv razlog kada je dostupan, bez lažnog uspeha ili pune crvene kartice. Boja uvek ima tekstualno značenje.

### 15.4 Prvi susret i objašnjenja

Predlog je **opcionih 3 kratka koraka**, ne obavezna prepreka registraciji ili prvom zadatku:
1. Pomoć počinje razgovorom — opiši, proveri, objavi.
2. Imaš vremena da uskočiš — u blizini ili na daljinu.
3. Dogovorite se, završite zajedno — poruke, termin, sledeća radnja.

Svaki ima Preskoči. Na poslednjem Kreni, zatim Početna za prvi dan bez izmišljenih aktivnosti. Postojeći brand intro ne ponavlja se posle svakog ulaska. Korisnik koji dođe iz deep linka odmah ide na kontekst, ne kroz karusel. Ako je onboarding odbijen, isti sadržaj ostaje u Pomoći.

Kontekstualno učenje je važnije od tri slajda:
- prvi Discovery: mali poziv „Povuci listu da vidiš zadatke“, dostupan i ponovo iz Pomoći;
- prvi radni prostor: jedna rečenica šta su objave, prijave i Dogovori;
- prvi AI: kratko predstavljanje svrhe, bez pet sugestija i četiri stalne kartice;
- prva lokacija: pokaži pin i postavi jedno pitanje; potvrđeno se sklapa u miran red;
- prva prijava: stvarna potvrda vodi na sopstvenu prijavu i pokaže gde čeka odgovor;
- prvi Dogovor: prikaži prihvaćene činjenice i sledeću radnju, bez generičnog tour-a preko njih;
- dozvole: objašnjenje tek po zahtevu za mikrofon, fotografiju ili lokaciju, bez sva tri system prompt-a pri ulasku.

Pravila budućeg seen/dismissed stanja: odvojiti „video poziv“, „zatvorio“ i „završio“ po verziji objašnjenja; ne prikazivati ponovo zato što je komponenta remountovana. Ne čuvati privatne podatke u tim zastavicama. Greška storage-a ne blokira rad. Ako korisnik zatvori pomoć, radnja/tok ostaju sačuvani. „Razumem“ u HTML-u samo otvara sledeći lokalni primer; nema trajnog upisa niti dokaza da to već radi u aplikaciji.

### 15.5 Kako se unapređuje ceo proizvod — dopuna svih prethodnih blueprint-a

Svaka porodica zadržava stvarne podatke i poslovne komande iz prethodnih 62 redova. Sledeće su odluke o prikazu za vlasnički pregled, ne implementirani novi feature-i.

| Porodica | Šta korisnik mora odmah da razume | Novi ili precizniji raspored / korisnost | Ponašanje, stanje i izlaz |
|---|---|---|---|
| Ulaz / prijava / oporavak | Gde se prijavljuje i kako nastavlja | Brand završava na jasnim auth radnjama; forma bez dekorativnih KPI | Greška uz polje; sačuvan povratak deep linka; bez endless intro |
| Početna, prvi dan | Mogu tražiti ili ponuditi pomoć | Dva velika ulaza, kratko objašnjenje, relevantan radni profil | Bez lažnih termina; preskočiva pomoć |
| Početna, povratak | Šta sada traži mene | Jedna najvažnija obaveza, zatim termin, pa moje liste | Badge samo za poznatu radnju; promena posle readback-a |
| Discovery | Šta mogu da radim gde gledam | Jedan map/list prostor sa nav HALF/FULL, kapsule relevantnih kriterijuma | Stale-safe rezultati, isti filteri, povratak na kameru |
| Van mape | Remote i bez pina su različiti | Pretraga + isti uslovi + tri jasno označena skupa | Bez lažnog city scope-a i izmišljene lokacije |
| Search i mesto | Šta tražim, gde tražim | Grad: Ceo grad / Izaberi deo; ulica samo kad postoji podatak | Draft odvojen, Apply pokreće jedan upit; B podiže listu samo po izboru |
| Filteri | Koji uslovi su uključeni | Relevantne grupe, broj aktivnih, preview i čist reset | Greška preview-a ima Ponovi; Apply bez lažnog broja |
| Task card | Zanima li me ovaj zadatak | Naslov, cena/ponude, mesto, termin; samo važan kapacitet/uslov | Dugi opis u detalju; odsustvo cene nije nula |
| AI zadatak | Razgovaram i nastaje moj zadatak | Gemini-like tekst, jedan aktivan vizuelni podatak, mirna istorija potvrda | Ispravka činjenice revidira isti podatak, ne proizvodi nove kartice svuda |
| AI radni profil | Otkrivamo šta mogu da ponudim | Kratak uvod, jedno pitanje, veštine/oprema/radijus u pravom trenutku | Završetak skriva composer i otvara pregled; ne pita drugo ime |
| Lokacija / ruta | Da li je ovo pravo mesto | Mapa dominira; svaka tačka po ulozi; konačan pregled cele rute | Pin i adresa usklađeni; tačna lokacija samo uz dozvolu; linija nije lažna drumska ruta |
| Fotografije / glas | Šta ću poslati i u kom stanju | Pregled priloga i jasan capture/send/retry u istom lifecycle-u | Dozvola odbijena ne blokira tekst; media greška ne briše nacrt |
| Pregled / objava | Kako drugi vide moj zadatak | Ista javna task projekcija uz vlasnikovu privatnu adresu | Objavi tek iz prihvaćenog pregleda; zatim stvarni objavljeni task/map selection |
| Moji zadaci | Koja objava traži moj izbor | Kompaktna lista s brojem prijava/pokrivenosti, nacrti jasno | Svaki red vodi na pravi zapis; status ne menja značenje nakon paging-a |
| Kandidati / poređenje | Koga biram i pod kojim uslovima | Iste važne činjenice za 2 osobe, zatim druge; jedna potvrda izbora | Cena/termin/kapacitet jasni; conflict prikazuje promenu, ne lažan uspeh |
| Moje prijave | Čekam odgovor ili sam na redu | Stabilni filteri i moja ponuda, jasno izabrana→Dogovor | Završena prijava odvojena od završenog posla |
| Dogovor detalj | Sa kim, šta, kada, po kojoj ceni, sledeće | Kratak zaglavni sažetak, aktivna radnja, Pregled/Poruke isti kontekst | Izmene porede staro/novo; ostale radnje nisu skrivena glavna navigacija |
| Poruke 1:1 / grupa | Ko govori o kom zadatku | Jedan razgovor, mali task context, mediji u istom toku | Draft pri pozadini, optimistic→receipt, incoming/read bez ručnog otključavanja |
| Raspored | Šta imam danas i kada | Mesec/Nedelja/Dan, odabrani datum, čitljivi termini | Back/početna vraćaju odabrani datum; bez termina poseban red |
| Završetak / ocena | Ko još potvrđuje | Jedna sledeća radnja i kratak završni pregled | Unknown nije success; slavlje tek posle potvrde, ocena ostaje dostupna |
| Obaveštenja | Šta se promenilo i za koji posao | Naslov zadatka + kratak događaj, datum grupe i unread | Tačan deep link; telefonska dostava nije zaključena iz rendera |
| Profil / radni profil | Ko sam i šta nudim | Identitet/reputacija, jedna radna površina, dostupnost; bez finansijske ploče | Uređivanje jednog imena; radno područje preko dozvoljenog ugovora |
| Settings / account | Gde je konkretna postavka | Kratke grupe i neutralni redovi; objašnjenje samo posledice | Toggle ima pending/error; unknown nije isključeno; nema duplog privatnosnog huba |
| Privacy / izvoz / brisanje | Posledice i moje opcije | Jasno status+radnja, duži detalji dostupni | Bez automatskog brisanja, lažnog procenta ili obećanja roka |
| Podrška / prijava greške | Kako dobijam pomoć | Kontekst zadatka, ljudski tekst, pregled onoga što šaljem | Ne slati privatne logove bez znanja; error zadržava tekst |
| Empty / offline / greška | Zašto nema sadržaja i kako dalje | Različiti uzroci imaju različitu radnju, ne univerzalno Osveži | Warm sadržaj ostaje; cold loading zaseban; pretraga/paginacija ne brišu poziciju |

### 15.6 Vizuelni karakter i motion bez dodatnog tereta

Bela je površina, crna vodi čitanje, siva objašnjava. Zelena je glavna radnja i odabir. Narandžasta je mala oznaka kada čeka korisnik ili izabran pin. Raznobojni originalni 2.5D predmeti označavaju mesto, termin, novac, ljude i veštinu; ne koriste se kao svaki chevron/close/back. Bez pet novih stilova ikona, mint pozadine i stalnog glow-a.

Robot je isti identitet u oba AI toka; radni kontekst i tekst razlikuju nameru. Nije svaki bubble avatarski poster. Prvi susret može imati veliki artwork, tokom rada mali miran marker. Postojeća PNG glava nije rigovan robot: ne obećavati treptanje/ruke dok nema pripremljenih slojeva ili odobrenog asseta. Novi logo nije neophodan da bismo rešili hijerarhiju.

Motion povezuje uzrok i posledicu: ručica/lista/tabovi zajedno; pin u karticu; potvrđena lokacija u kratak red; izbor kandidata u stvarni Dogovor; poruka u potvrđen send-state; završetak tek posle server ishoda. Bez ponovne ulazne animacije svakog zapisa pri refresh-u ili povratku. U HTML-u sheet/nav koriste transform 240ms sa postojećim easeOut (.23,1,.32,1); prvi onboarding jednokratni artwork enter 700ms samo za objašnjenje. Reduced-motion uklanja ornamentalno pomeranje. Nema novih biblioteka, blur filtera ili pozadinskog loop-a. Pokazani robot ostaje statičan original; animira se njegova ulazna kompozicija, ne lažna anatomija.

### 15.7 Airbnb i granica inspiracije

Pročitani primarni izvori:
- [Airbnb — Search for listings](https://www.airbnb.com/help/article/252): mapa, pomeranje/zoom, destinacija/naselje/adresa i filteri predstavljaju različite ali povezane ulaze u pretragu. To podržava naš princip jednog prostora, ne dokazuje tačne HALF/FULL detente njihove aktuelne Android verzije.
- [Airbnb — Summer Release 2025](https://news.airbnb.com/product-releases/airbnb-2025-summer-release): objedinjen kontekst rasporeda i poruka. Prevodi se u USKOČI Dogovor, ne kopiranje turističkih proizvoda.
- [Airbnb istraživači — Learning to Rank for Maps](https://arxiv.org/abs/2407.00091): gustina i izbor informacija za mapu su poseban problem. USKOČI zadržava isti filter i tačan ID povezivanja kartice/pina. Ne kopirati rangiranje bez podataka.

Nije tvrđeno da je izvršen Airbnb Android journey ili gledan njihov trenutni motion snimak. Zahtev HALF/FULL dolazi direktno od vlasnika i postojećeg USKOČI pravila; ne treba ga opravdavati izmišljenom konkurentskom proverom.

### 15.8 Šta bira vlasnik, šta se radi posle izbora

**Odmah ispravljeno u skici:** HALF sa navigacijom, povezane map/list visine, remote/off-map filteri i Za mene, pretraga lokalnih primera, jasnije radne liste i uvodne skice. **Nije implementirano u app.**

Odluke koje imaju stvarnu cenu promene:
1. Radni prostor A (tri pogleda) ili B (postojeće liste povezane); C prikazan radi poređenja, preporuka da ostane na Home.
2. Ako A: naziv glavnog taba ostaje Dogovori ili postaje Moje/Moj rad. Nema tihog preimenovanja.
3. Search B (potvrda podiže FULL) naspram A (polje tek na listi); prethodne alternativne skice ostaju.
4. Jednom ponuđeni, preskočivi uvod od 3 koraka ili samo kontekstualna pomoć. Moja preporuka je kratak opcion uvod uz kontekstualnu pomoć.
5. Postepeni Back kroz FULL/HALF/COMPACT ili direktan FULL→mapa; demonstracija nije automatsko odobrenje.

Kasniji redosled ugradnje: (1) stabilne postojeće liste/statusi i odnos prijava→Dogovor, (2) Discovery HALF/remote/kapsule i zaštita paging-a, (3) prihvaćena radna arhitektura, (4) dva AI toka i lokacija/ruta, (5) onboarding/Home i duboke površine iz matrice, (6) artwork/motion završetak kroz iste komponente. Čitanje živog DEV stanja ponoviti pre svakog serverskog paketa. Svaka server promena ostaje izričito odobrenje; skica sortiranja nije takvo odobrenje.

**URADIO:** ciljano produbljen source review i postojeća celovita specifikacija, revidirana lokalna galerija. **DOKAZAO:** 78 render funkcija u Node VM uz zaštićeni window.top; veze/slike/fontovi; programske kombinacije lokalnih filtera, podizanje/spuštanje nav stanja, tekst pretraga i uvodni linkovi. **NIJE DOKAZANO:** browser geometrija, pravi pointer/touch drag, scroll restore, FPS, Android/telefon i backend izvršenje. Browser file:// pristup ranije blokiran; nije zaobiđen drugim browserom/serverom. **SLEDEĆE:** vlasnik pregleda revidirane skice, zatim odvojena odobrena implementacija.


<a id="telefon-plan-20261008"></a>
## 16. Plan posle stvarnog pregleda HONOR-a — 8. oktobar uveče

**Mandat:** vlasnik je tražio samostalnu analizu, bolji plan celog proizvoda i korišćenje njegovog telefona za pregled/slike. Ovo zatvara jedan ograničen pregled i dopunjuje postojeći nacrt, ne uvodi novi master. Predlozi ekrana i dalje nisu ugrađeni u aplikaciju. Odobrenje za pregled telefona nije odobrenje za slanje push-a, aktivaciju DEV-a ili zamenu ekrana bez prikaza predloga.

### 16.1 Dokaz i granice

- **IZVOR:** čist checkout na `19d0cea5895e1062fbf240a82ce96e6b235928b1`, `git fetch novi`; obe radne grane polaze od njega. Ciljano čitani Discovery, ListRow, profil, push settings/transport i postojeći handoff. Prethodni celoviti source inventar ostaje u §10–15; nije ponovo izvršen svaki put kroz aplikaciju.
- **TELEFON:** HONOR VKP-NX9, Android 16,1264×2728,560dpi, font1.15; `rs.uskoci.preview`, versionCode 35. Izvor **4e0ea50614dc74af9a1dee771eb8fb7e53034892** sada je vezan dokazom: SHA-256 instaliranog base.apk identičan je preuzetom APK-u iz GitHub Actions run **37801944334**, artifact **11563501200**, grana `visual/phone-20261008-3`. Hash **7122b1c22073af4f4b38330e22115dbf02536cef0072092502aa19fa06d2fea1**. Nije instaliran drugi APK.
- **DEV:** read-only kontrola pre pregleda i posle njega: **235 / 3a785d42**. Završno očitavanje `2026-10-08 20:48:37 UTC`:0 aktivnih push uređaja,0 runtime-readiness redova. Nije čitana vrednost Edge secret prekidača, pa se iz praznog readiness-a ne zaključuje pouzdano ENABLED ili DISABLED.
- **Slike:** 22 lokalna snimka, uključujući povratke, oko22:38–22:47 lokalno. Manifest [PHONE_REVIEW_20261008.json](PHONE_REVIEW_20261008.json) beleži svaki hash. Privatne PNG/XML datoteke su van repozitorijuma u `C:/Users/user/Documents/Codex/uskoci-phone-review-20261008`. Ne slati ih na javnu tablu; sadrže stvarne podatke naloga.
- Pregledane površine: mapa COMPACT/HALF/FULL, filteri, pretraga, Početna, lista Dogovora, Moji zadaci, Moje prijave, Profil, podešavanja obaveštenja i otvaranje Napredno, Privatnost. Back/povratci na ovim ulazima su posmatrani. Telefon vraćen na Početnu. Nisu dodirnuti prekidači, čuvanje, povezivanje push uređaja, objava, prijava, slanje, otkazivanje, izvoz ili zatvaranje naloga.
- **Nije dokazano:** svi62 tokovi, AI odgovor/lokacijska potvrda/ruta, pin→detalj povratak, read-state razgovora, delivery, FPS,100/200/350ms ciljevi, iOS, produkcija. Screenshot i uiautomator nastaju uzastopno: filter screenshot hvata loading, kasniji XML već broj6; to nije dokaz zaglavljenog učitavanja. Nije snimljen video niti meren motion. Nijedna cela kontrolna stavka ne postaje Telefon=PASS samo zato što je viđen njen početni ekran.

### 16.2 Stvarni nalazi, sa preciznim predlogom

| ID / nivo | Šta je viđeno i zašto smeta | Predlog i granica | Dokaz / važnost |
|---|---|---|---|
| H01 / KEEP | Tabovi se pojavljuju na HALF i FULL; COMPACT ih nema. | Sačuvati ovo ponašanje. Problem starog HTML primera ne prijavljivati kao kvar APK-a. | TELEFON01–03, visoko za orijentaciju |
| H02 / FIX | Placeholder pretrage prelama se i donji deo teksta je odsečen. | Kraći primer, ispravna visina i jednoredno ponašanje polja; unos ostaje čitljiv i uz tastaturu. Proveriti stvarni input wrapper, ne samo menjati font. | TELEFON06; `DiscoverySearchPanel`/`SEARCH_WORDS`; visoko, visual/accessibility |
| H03 / FIX | „Pravila i saglasnosti“ u Profilu se raspada na delove reči jer desna vrednost zauzima široku kolonu. | Za duže vrednosti u istom ListRow sistemu status ide ispod naslova, bez smanjivanja slova. `ListRow` trenutno dopušta value do50% širine; `useLayoutClass` na361dp/font1.15 ne stackuje. To objašnjava ograničenje rasporeda; ispravku dokazati slikom. | TELEFON19 i20; `ListRow.tsx`, `textScale.ts`, `ProfileHubPresentation`; visoko, visual |
| H04 / RECOMPOSE | Krupne search/kapsule/senke i ponovljen veliki brand znak na pinovima konkurišu karticama i geografiji. | Jedna dominantna search površina; kapsule niže vizuelne težine uz istu dodirnu zonu. Cluster prvenstveno broj; pojedinačni marker jednostavan, selekcija narandžasti rub/halo. Pokaži novu skicu pre promene. | TELEFON01–03; srednje/visoko, visual; bez tvrdnje o kolizijama na velikom obimu |
| H05 / FIX ALIGNMENT | „Za mene“ je ispred „Na daljinu“. Off-map ulaz nije vidljiv u početnoj kompoziciji. | „Na daljinu“ prvo po odluci vlasnika; vidljiv „Nisu na mapi“, bez skrivanja samo u ⋯. Ne svesti remote i bez javnog pina na isti pojam. | TELEFON01–03; owner decision6; visoko, UX |
| H06 / RECOMPOSE | FULL i dalje ima širok dekorativni razmak/map pozadinu između vrha i liste; plutajuća „Mapa“ prekriva deo kartice. | Jedan beli header liste; kontrola povratka na mapu sa rezervisanim prostorom, ne preko sadržaja. Search A/B ostaje izbor vlasnika. | TELEFON03; srednje, UX/visual |
| H07 / IMPROVE | Kartice u ličnim listama su gotovo mali detalji; oko 2 zapisa u prvom prikazu. | Javni Discovery record ostaje bogatiji, lične liste kompaktnije: naslov, jedan ključni podatak, status/akcija. Proširenje samo za dodatni sadržaj; glavni dodir direktno vodi u detalj. Ne uvoditi obavezna tri klika do detalja. | TELEFON10/12; srednje/visoko, skeniranje |
| H08 / RECOMPOSE | Dogovori imaju Aktivni/Istorija i kalendar, ali nema vidljivog prelaza ka Mojim zadacima/prijavama niti filtera moje uloge. Red kaže ulogu druge osobe, što traži dodatno tumačenje. | Radni prostor iz§15.3, plus **Sve / Tražim pomoć / Uskačem** unutar Dogovora. Svaki red jasno govori tvoju ulogu i ko čeka koga. Status nije uloga. Server-globalni filter prvo proveriti, ne filtrirati samo prvu stranu. | TELEFON08+SOURCE; visoko, UX/data |
| H09 / KEEP+IMPROVE | Izabrana prijava već ima zasebno „Otvori Dogovor“. | Sačuvati direktan put i tačan ID. Ujednačiti filtriranje tokom paging-a; „Povuci prijavu“ ostaje dostupno ali vizuelno sporedno i sa potvrdom, ne skrivati ga suprotno J15. | TELEFON12; visoko za tok, srednje visual |
| H10 / IMPROVE | Home ima dva velika ulaza i koristan „Čeka te“, ali nacrt vizuelno skoro sustiže glavne ulaze. | Dve namere ostaju jake; kompaktan red sledeće stvarne obaveze, zatim termin ako postoji. „Mogu odmah“ ostaje jedinstveno stanje, ne obećava automatski aktivan HITNO dispatch. | TELEFON09; srednje, hijerarhija |
| H11 / IMPROVE | Profil pokazuje mesto naloga i drugo radno područje bez objašnjenja razlike; privatnosne prečice se ponavljaju u Profilu i Privatnosti. | Jasno imenovati mesto profila / područje rada. Jedan dom privatnosti, eventualno direktne prečice samo uz istu semantiku. Kompaktniji identitet/reputacija, bez izmišljene zarade. | TELEFON14/19/20; srednje, UX |
| H12 / FIX COPY+READINESS | Obaveštenja: status „telefon nije povezan“, niz zelenih preference switch-eva i posebno „stanje slanja nije potvrđeno“ lako izgledaju kao protivrečnost. | Gornji status govori šta telefon stvarno može; preferencije ispod govore šta želiš primati. Unknown ostaje unknown. Jedna konkretna radnja, bez lažnog „sve uključeno“ ili generičnog objašnjenja servera. „Ostalo“ ima kratko dostupno objašnjenje vrsta događaja. | TELEFON15–17+DEV0 aktivnih; visoko, product |

Naslov „Podešavanja“ u push delu namerno je skraćen ranije da ne puca u2 reda: ne vraćati duži naslov naslepo. Isto tako starija rečenica uz „Zatvaranje naloga“ na ovom APK-u **već ima kasniji source fix6ebef10f**; ne raditi istu popravku ponovo. Phone/source razlika nije nova regresija.

### 16.3 Redosled završavanja — celoviti paketi, ne kozmetika dugme po dugme

Ovo je raspored naredne implementacije nakon pregleda predloga; sada su audit, plan i fizičke slike. Svaki paket ima prvo konkretan ekran, zatim source zahvat i jednu ciljanu proveru rizika. Ne ponavljati ceo E2E za promenu razmaka.

| Paket | Šta korisnik dobija / tačne površine | Uvezivanje i izlazni kriterijum | Preduslov |
|---|---|---|---|
| 1. Jasno čitanje i zajedničke kontrole | H02/H03, dugme primarno/sporedno/destruktivno, chip selected/loading, settings red sa dugom vrednošću; isti sys, ne nova biblioteka | Primeri na361dp/font1.15 bez odsecanja, osnovni izgled1.0 i fallback1.3;48dp dodir ostaje. Modal zaglavlje/close/footer ne seku sadržaj. | Pokaži pre/posle kompoziciju; potvrda ekrana |
| 2. Discovery kao jedna celina | COMPACT/PEEK/HALF/FULL, search/grad→deo→ulica, filteri, „Nisu na mapi“, remote/Za mene, jasni pinovi/clusteri i kompaktna attribution | Isti query/taskID/kamera/sort/cursor; detalj→Back vraća mesto; off-map paged scope odvojen od lokalnog dočitavanja. Filter preview ima retry,0 nije error. Sačuvati već potvrđen HALF/FULL nav. | SearchA/B i postupni Back izbor; DEV promena posebno |
| 3. Lični rad i saradnja | Jedan razumljiv ulaz u objave/prijave/Dogovore; uloga, status, čekanje, sortiranje i Raspored; kandidati/poređenje | Izabrana→tačan Dogovor; moje objave sa više osoba ne svode se na jedan Dogovor; završeno koje čeka ocenu ostaje vidljivo. `publishedAt`, sort i unread reader ugovori ne falsifikuju se klijentom. | HubA/B i ime ako se menja; novi globalni filter/sort samo uz backend dokaz |
| 4. Dva AI razgovora i objava | Kratak uvod, mirni balončići, jedan aktivan podatak; mapa/pin ili pojedinačne tačke rute; potvrđeno se sklapa; završna kartica tek na kraju | Govorna/tekstualna potvrda i ručni pin koriste postojeću reviziju; adresa prati novu tačku. Cela ruta u pregledu i detalju; navigacija po dozvoljenim tačkama. Pregled je budući javni zadatak + vlasnikova tačna adresa. Objava→stvarni task→map/listselection. | Nema nove AI logike naslepo; paid probe i Edge zasebno; bez lažne drumske linije |
| 5. Poruke i obaveštenja | Razgovor u kontekstu Dogovora, grupa odvojena; tekst/slika/glas isti lifecycle; događaj+zadatak+vreme | Draft preživljava pozadinu; incoming bez ručnog refresh-a; potvrđen send/read; paginacija; unknown/retry ne duplira. Unread ne izmišljati. Push lanac u§16.4. | Testni nalozi/tačna dozvola za realno slanje |
| 6. Home, ulaz, profil, dostupnost i kalendar | Dve namere, stvarno Čeka te, prihvaćen termin,3 kratka preskočiva uvoda; identitet/reputacija/radno područje; Mesec/Nedelja/Dan | Deep link preskače intro; pomoć ne ponavlja se svaki ulaz; ista dostupnost na Home/profilu; nema KPI izmišljenih podataka. | Izbor onboarding-a, ne novi auth/navigation sistem |
| 7. Duboki ekrani i kompletna stanja | Nalog/privatnost/podrška/izvoz/brisanje, mediji/dozvole, empty/offline/error/unknown; očisti duplikate i statusne redove | Izostanak dozvole ostavlja tekstualni put; Back ne odbacuje neupisano bez upozorenja; unknown ne glumi uspeh; destruktivna radnja kaže tačan predmet/posledicu. Pravne činjenice ostaju tačne. | Pravne/privatnosne izmene zasebno od UI |
| 8. Artwork, motion i release provera | Ujednačene raznobojne2.5D činjenice, isti robot u2 namere, originalan ulaz; motion složen sa sadržajem | Nema montaže svake kartice pri povratku, deformisanih PNG robota, beskonačnog glowa. Tačan APK→kratke phone probe; potom jedan ceo tok2 naloga. Production/iOS/plaćanja imaju stvarne posebne preduslove. | Odobreni asseti, bez novih paketa bez reči; prodavnica/novac nisu automatski odobreni |

Ne čeka se8.paket da bi se ranijim ekranima dodali pressed/transition/keyboard detalji: motion se projektuje i proverava u paketu kome pripada. Poslednji paket usaglašava celinu. Serverski posao priprema se nezavisno od vizuelnih odluka, ali ne primenjuje bez dozvole. RETIRE-V1/čišćenje nisu preduslov za popravljanje odsečenog naslova.

**Dogovori — tačan predlog:** vrh sa nazivom prostora i Rasporedom; stalni pogledi Dogovori/Moji zadaci/Moje prijave ako vlasnik izabere hubA. Unutar Dogovora Aktivni/Istorija; Sve/Tražim pomoć/Uskačem kao uloga, Čeka mene kao stanje. Kompaktan red: naslov zadatka, osoba+moja uloga, termin ili „Termin nije dogovoren“, iznos kada potvrđen, jedna sledeća radnja. Ne gurati5 redova kapsula na ekran: ređe uslove u odvojeni filterpanel, primenjene uslove kratko prikazati. Historični otkazani i završeni ostaju razdvojivi. Glavni tap otvara Dogovor; proširenje sažetka nije obavezna prepreka. Brojač je globalan samo kad server daje total, ne broj prvih 20 učitanih.

**Modali i motion:** filter je privremeni nacrt uslova sa Očisti/Prikaži rezultat; odustajanje vraća primenjeno. Duga pretraga i mapa biranja su full-screen, kratka potvrda sheet. Bez sheet-a unutar sheet-a. Blur samo iza aktivnog sloja, sadržaj oštar i kontrastan; koristiti postojeći expo-blur uz stvarnu native proveru, bez globalnog GPU efekta. Sheet prati prst i preuzima prekinutu animaciju. Tabovi prate isti progress. Taster prvo daje pressed feedback, zahtev ne blokira vizuelnu reakciju. Potvrđena lokacija se sklapa uz očuvan scroll-anchor. Duži AI odgovor se ne animira slovo po slovo ako to usporava čitanje. Reduced-motion je poseban pristupačni prikaz; pun standardni motion ostaje. Konkretne100/200/350ms granice ostaju ciljevi, ovim pregledom nisu izmerene.

### 16.4 Push — kako do kontrolisane stvarne isporuke

**Ne pravi se novi dispatcher od nule.** SOURCE/istorijski application receipt `supabase/operations/dev-alpha/ledger/20261008_match_v1b_application.receipt.json` potvrđuje primenu MATCH-V1B232→233. Za remote/bez tačke postoje prvi300, potom1000/30min, limit10000 po reviziji i1000 po transakciji, sa uslovima prekida. To je izbor korisnika i pravljenje događaja/isporuka u bazi; nije dokaz da hiljade fizičkih push-eva već brzo odlaze.

**Transport:** current source `supabase/functions/uskoci-push-transport/index.ts:80,169` ima25s deadline i samo jedan RECEIPT +jedan SEND po tick-u. Uz dokumentovani minutni scheduler to je najviše1 SEND claim/min iz tog rasporeda, ne ograničenje svih mogućih paralelnih poziva. Claim/begin/complete, lease, UNKNOWN bez slepog replay-a, token lifecycle i privatni payload već postoje. Sačuvati ih.

**Dopuna starog PUSH-KAPACITET recepta:**40s petlja ne može samo da se umetne uz postojeći25s deadline; oba moraju da budu usklađena. I RECEIPT obrada mora da dobije ograničen budžet. Kada bi40 ticket-a/min zahtevalo po jednu proveru, a worker proverava 1/min, red bi rastao do39/min; to je aritmetički scenario, ne izmereni live promet. Ne zameniti jedan bottleneck drugim.40/min nije dokaz dovoljnog kapaciteta za 10000 korisnika.

Redosled:
1. **Priprema bez DEV promena:** dva bounded budžeta za SEND i RECEIPT, ukupan deadline sa rezervom za complete/readiness; stop naNONE i granice vremena/broja; agregirano degraded stanje. Dokaz na izolovanim/fake-provider slučajevima: backlog,429/5xx, UNKNOWN, timeout, dupli worker, receipt backlog. Nema probnog realnog slanja tokom razvoja.
2. **Single-target preflight na aktuelnom stanju:** kandidat `supabase/proofs/push_single_target/promotion/HANDOFF.md` ima istorijski disposable PASS vezan za ledger225/source roster99. Sada je235; potrebni su poređenje i novi dokaz tačnog apply/revert-a. Ne nazivati starog kandidata spremnim za deploy. Izmena binding-a/sertifikata ima posebno odobrenje.
3. **Konkretna vlasnikova reč za primenu:** prikazati tačan DB/Edge diff, preflight, rollback i cilj. Generalno slanje se ne uključuje kao prečica; kapacitet ne zaobilazi single-target kapiju.
4. **Povezivanje baš ovog telefona:** explicit enrollment/permission/session/revision readback. Današnja0 aktivnih +prikaz „nije povezan“ ne popravljaju se pukim globalnim flagom. Postavke željenih događaja, OS dozvola, registracija i transport četiri su različite stvari.
5. **Prvi odobren događaj:** account+role+session+device revision+event+delivery, pouzdan hard limit1 provider dispatch. Ostali redovi netaknuti, bez globalnog draina, cleanup-a i automatskog povlačenja preostalog CREATED. Istorijskih8 EXPIRED ima zaseban receipt7.10; to ne odobrava povlačenje novog reda.
6. **Dokaz tačnog puta:** isti događaj→push→tap cold/warm→tačan Dogovor/poruka→read. Postojeći flag `EXPO_PUSH_MESSAGE_TARGET_ENABLED` razlikuje exact-message payload od običnog INBOX; ne tvrditi da sada svi događaji vode na finalni detalj. Receipt/delivery stanje proveriti odvojeno od prikaza bannera. Screenshot tačnogAPK-a, privatni sadržaj vanGit-a.
7. **Tek potom kontrolisani rollout:** ciljna kašnjenja/obim, mere queue-age, stale tokens, quiet-hours i korisničke preference, multi-device, iOS odvojeno. Rollback isključuje admission/slanje bez gubitka ishoda već započetih pokušaja; posle admission-a ne primenjivati destruktivni pre-admission revert.

**Današnje DEV očitavanje (bez tokena/identiteta/tela):**2 neaktivna Android uređaja,0 aktivnih;1 CREATED i1 istorijski QUEUED/TICKET_PENDING pokušaj26.9;readiness 0 redova. Raniji Android push jeste dokumentovan26.9 u `PUSH_REAL_DEVICE_EVIDENCE.md`, ali sintetički event→Inbox nije dokaz današnje stvarne poruke→exact message→read. Tekstovi „Izabran si“/„posao kao završen“ u `_shared/pushNotificationCopy.mjs` zahtevaju usaglašavanje sa „ti bez roda“/„zadatak“; source predlog nije Edge deploy.

### 16.5 Kratka kritika iz šest disciplina

- **Product:** funkcionalno jezgro i dispatcher postoje. Ne prodavati novi renderer kao dovršen produkt i ne otvarati novu bazu da bi se rešila hijerarhija.
- **UX:** razdvojiti moju nameru, vrstu zapisa i status. Dogovor nije isto što i objava/prijava; sva 3 moraju biti lako dostupna istom nalogu.
- **Visual:** kvalitet artwork-a već daje karakter; problem je previše podjednako naglašenih površina, senki i krupnih kontrola. Smanjiti težinu okvira, ne čitljivost i dodirne zone.
- **Motion:** slike dokazuju krajnja stanja, ne glatkoću. Projektovati jednu kontinuiranu transformaciju lista/mapa/tabovi; pravi kvalitet dokazati snimkom i merenjem novogAPK-a.
- **Engineering:** globalni filter/sort/paging/push throughput su ugovori, ne frontend trikovi. Kapacitet prijema potvrda i izolacija slanja jednako su važni kao SEND petlja.
- **QA/accessibility:** dva konkretna prikaza odsečenog/prelomljenog teksta su dokaz za ciljani zahvat. Ne menjati telefonov font da bi slika izgledala bolje;1.0 osnovni izgled,1.15 vlasnikov i1.3 fallback proveriti na odvojenim odobrenim scenama.

Ovo su eksplicitni analitički uglovi glavnog autora; poseban read-only agentski pregled urađen je za push. Nisu6 nezavisnih eksternih sertifikacija.

### 16.6 Istraživanje i sledeća odluka

Ponovo čitani [Android navigation principles](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns):3–5ravnopravnih odredišta, sekundarni tabovi za srodan sadržaj, jedna istaknuta glavna radnja. To podržava naš predlog radnog prostora, ne odlučuje3/4taba umesto vlasnika. [Airbnb search help](https://www.airbnb.com/help/article/252) opisuje povezivanje mape, zoom/pan, lokacije i uslova;ne daje dokaz njihovih tačnihAndroid detenta niti motion-a. Material 3 sheet stranica vratila je samoJS zahtev, pa joj nisu pripisana nepročitana pravila. Vlasnikove reference su korisne za željeni osećaj, nisu uslov da se nastavi.

**Sledeća konkretna isporuka za izbor:** tri ključne kompozicije iz postojeće galerije doraditi prema ovom telefonu — (1)Discovery HALF/FULL + search A/B,(2)lični rad sa mojom ulogom/statusom,(3)AI jedna aktivna mapa→potvrđen red→završna kartica. Tek kad vlasnik vidi i kaže da, ugradnja u app. Duboke redove H02/H03 uključiti u isti odobren UI paket; server/push ostaju zasebni konkretni paketi. Ne tražiti da vlasnik ponovo napiše ceo brief ili sam napravi audit.

**URADIO:** fizički pregled,22 lokalne slike, tačno APK vezivanje, source/push analiza, dopuna postojećeg plana. **DOKAZAO:** navedena stanja telefona iDEV235/digest, ne sve poslovne tokove. **NIJE DOKAZANO:** novi izgled naAPK-u, motionbudžeti, AIruta, pushdelivery, ceoE2E/store. **SLEDEĆE:** prikaz revidiranih ključnih kompozicija i priprema bounded push paketa pre zahteva za njegovo odobrenje. App source, DEV/Edge, CIpostavke i produkcija nisu menjani. Telefon jeste korišćen za odobrenu navigaciju; podaci nisu brisani, nije bilo odjave/instalacije/slanja. Objavljena Claude tabla nije ažurirana ovim pregledom; lokalne projekcije se osvežavaju iz registra.


### 16.7 Implementacija kontinuiteta posle vlasnikovog odobrenja

Vlasnik je naknadno odobrio samostalnu implementaciju i pregled na oba uređaja; prethodni stop pre svakog UI predloga je prevaziđen tom odlukom. [Paket i precizan obim dokaza](CONTINUITY_FINISH_20261008.md): Discovery retry/redosled, stabilne lične liste, uloga u Dogovorima, čitljiv profil, zatvoren worker chat, grupni ACK i privremeni nacrt. Nema tvrdnje da je novi izgled viđen na uređaju pre instalacije tačnog APK-a. Push registracija je sada 1 aktivan session-bound Android uređaj; pređašnjih0 ostaje istorijski nalaz.


### 16.8 Vlasnikove Airbnb reference — kriterijum kvaliteta cele aplikacije

**Ulaz:** vlasnikove slike 14395–14424 i naknadna poruka 8.10: najviše gledati stil, jasnoću, boje, moderan oštar prikaz i lakoću; samostalno osmisliti šta nedostaje svakom USKOČI ekranu. Ovo je dalja razrada odobrenog pravca, ne novi master. Slike su vizuelni dokaz konkretnih stanja Airbnb-a; trajanje animacija, FPS i ponašanje između kadrova iz njih nisu izmereni. Nema preuzimanja Airbnb logotipa, ilustracija ili poslovnih pravila.

**Merilo:** pri prvom pogledu razumeti gde sam, šta je najvažnije i šta mogu sledeće. Bela čitljiva površina; crn vodeći tekst, siv kontekst, zelena vodeća radnja; postojeće raznobojne 2.5D ilustracije kao akcent. Oštri originalni resursi u odgovarajućoj rezoluciji i bez deformisanja, ne globalni blur niti filter preko celog proizvoda. Funkcionalne ikone moraju biti prepoznatljive; ikona bez teksta samo kada je značenje jasno, uz pristupačan naziv. Uloge i posledice radnje ostaju u rečima.

| Dokaz sa reference | Primena u USKOČI | Granica / kriterijum prihvatanja |
| --- | --- | --- |
| 14395,14416: velika jasna hijerarhija i odabrane ilustracije | Početna zadržava dve namere; ispod njih samo stvarna obaveza. Profil ima jedan identitet i razumljive grupe redova. | Ne dodavati KPI kartice ili prazne funkcije radi popunjavanja. Prazan prostor služi odvajanju, ne tera glavnu radnju ispod ekrana. |
| 14396–14402: jedan aktivan unos, prethodni izbori kao sažeci | U složenom unosu prikazati aktivan korak i sažet potvrđeni podatak; AI lokacija/ruta i ručno uređivanje koriste isti podatak i istu reviziju. | Ne pretvarati svaku brzu pretragu u obavezan čarobnjak. Search/filters ostaju odvojeni dok konkretna proba ne opravda drugu kompoziciju. |
| 14403–14409: mapa, tri položaja liste, tabovi i veliki zapisi | COMPACT: dominira mapa, tabovi skriveni. HALF: mapa + prve kartice + tabovi. FULL: lista + tabovi; povratak na istu mapu i kameru. | Povlačenje podigne listu pa pređe u skrol; povratak do offset0 pa povlačenje naniže spušta listu. Obnova podataka ne preuzima taj gest. |
| 14403–14409: kapsule i kartice | „Na daljinu“ prvo, „Za mene“, korisni vremenski/uslovni izbori; „Nisu na mapi“ jasan ulaz sa istim filterima. Kartica kaže zadatak, iznos ili da nije naveden, vreme, mesto/režim i bitan uslov. | Ne gomilati više redova kapsula. „Za mene“ objašnjava odbijen/nepotpun radni profil. Guste lokacije koriste clustere/izbor, ne preklopljene nečitljive cene. |
| 14410–14412: filteri sa jasnim grupama i stalnom završnom radnjom | Kratko zaglavlje, ravne sekcije sa separatorima, nacrt izbora, Očisti i Prikaži rezultate. Aktivni uslovi ostaju razumljivi po zatvaranju. | Broj samo iz autoritativnog pregleda; greška nije nula. Bez lažnog histograma ili kategorije koju server ne podržava. Back odustaje od neprimenjenog nacrta. |
| 14413–14415: poruke, prazno stanje, kratak meni | Poruke: osoba + zadatak + poslednja poruka + stvarno vreme/nepročitano. Prazno: jedan artwork, jasan razlog, odgovarajući sledeći korak. Podešavanja kroz kratak sheet. | Razgovor: composer ostaje iznad tastature; prilozi i glas imaju stvarna stanja slanja/neizvesnog ishoda. Ne prikazivati potvrdu pre servera. |
| 14416–14419: profil i duboki ekrani | Profil: identitet/reputacija, Kako mogu da uskočim, Nalog i pomoć. Područje rada se razlikuje od mesta naloga; Dogovori razdvajaju moju ulogu i status. | Duga vrednost ispod naslova; kratki redovi sa jasnim izlazom. „Tražim pomoć / Uskačem“ je filter stvarnih Dogovora, ne promena celog naloga. |
| 14420–14424: privatnost sa objašnjenjem i grupama | Postojeće kontrole privatnosti imaju opis ko šta vidi i kada promena važi. Izvoz, zatvaranje naloga i pravne informacije imaju jasne zasebne ulaze. | Ne dodavati prividne radio opcije ili prekidač AI treninga bez stvarnog ugovora. Vizuelno sređivanje ne menja prava pristupa, adresu ni pravnu činjenicu. |

**Sadržaj po svrsi, ne popunjavanje praznine:** za svaki ekran iz postojeće matrice proveriti jednu odluku korisnika, 3–4 ključne činjenice, sve postojeće sekundarne radnje i razumljiv izlaz. Dodati informaciju samo ako rešava konkretno pitanje (ko čeka koga; koji termin je potvrđen; kome se šalje; šta uključuje iznos; zašto nema rezultata). Duplirane opise skratiti. Lista zadataka služi izboru, lične liste praćenju obaveza, Dogovor saradnji, razgovor dogovaranju; zato ne koriste svi istu veliku karticu.

**Motion ugovor:** zadržati postojeći Gorhom/Reanimated sistem. Sheet i mapine kontrole slede stvarnu poziciju. Bez automatskog zoom-a za svaku promenu visine liste; ručni zoom/pan zadržava nameru, izabrani pin ostaje vidljiv iznad kartice, cluster približava oblast bez proizvoljnog izbora zadatka. Ne animirati svaku poruku i svaki red pri povratku. Zatvaranje panela vraća kontekst i fokus. Reduced motion zadržava funkciju. Statične slike nisu PASS za ove kriterijume.

**Utvrđen source sukob:** `DiscoveryPresentation` je davao `onRefresh` svom `BottomSheetFlatList`. Gorhom5.2.14 tada na FULL predaje content drag osvežavanju i ne spušta listu. Uklanja se samo taj konflikt: ručno osvežavanje premešteno u postojeći Još meni, recovery ostaje. Ne menja se biblioteka ni zaštita vraćanja scroll pozicije. Provera je FAIL-pre/PASS-posle na binding-u, a pravi neprekinuti gest mora posebno da se vidi na tačnom APK-u.

**Native izlaz:** 1.15font na istom uređaju; HALF→FULL→skrol u jednom potezu; duboka lista→offset0→spuštanje; kratka/prazna lista; detalj→Back čuva scroll; poslednja kartica dostupna; lokacijska/Za mene poruka vidljiva i u FULL; prekid animacije/Back/reduced motion; zoom-in/out i gusta grupa pinova. Svaki dokaz vezati za APK/source. Screenshots vlasnikovog Airbnb-a nisu potvrda USKOČI implementacije.


### 16.9 Mirna oznaka izvora mape

Vlasnikova dopuna posle §16.8: attribution je mala jedna linija dole levo, fiksirana uz donji mapin prostor iznad osnovne spuštene liste. HALF/FULL i pin kartica ga prirodno prekriju; oznaka ne putuje nagore, nema svoje animacije ili stalnog plutajućeg panela. Visina početnog spusta rezerviše mesto samo dok je mapa otvorena; trenutna visina sheet-a i visina kartice ne određuju položaj oznake. Prekrivena kontrola isključena je iz dodira i accessibility fokusa. Izvori ostaju dostupni po vraćanju na mapu. Moja lokacija, clear-band kamere i pinovi imaju zasebno postojeće ponašanje. Ovo je izričit izuzetak ranijoj zajedničkoj vožnji svih mapinih kontrola.

### 16.10 Učesnici i izbor razgovora

Pregled višestrukog zadatka počinje stvarnim ovlašćenim spiskom učesnika, zatim jasno označenim bilateralnim Dogovorom i njegovim uslovima. Razgovor ima izbor „Svi učesnici / Privatno“. Privatni izbor za osobu koja traži pomoć vodi samo na ID-eve iz autoritativnog management readera; za učesnika samo na sopstveni Dogovor sa tražiocem. Sačuvana poruka u grupi ostaje vidljiva grupi; promena kanala ne menja publiku već poslate poruke.

Imena i inicijali uz početak niza poruka identifikuju pošiljaoca; fotografije ostaju u postojećem zaglavlju/spisku učesnika. Ne učitavati istu zaštićenu fotografiju ponovo za svaki oblačić. Dodatni privatni razgovori imaju straničenje, retry i zadržane prethodne izbore. Zastareli callback posle promene naloga, povratka u pozadinu ili napuštanja ekrana ne otvara drugi razgovor.

**Obim implementacije09.10:** glavna lista sada grupiše ovlašćene bilateralne zapise po stvarnom zadatku i sopstvenoj ulozi. Jedan beli zapis nosi naslov, ulogu i broj saradnji; redovi osoba imaju avatar, ime, vlastiti termin/mesto, iznos, status i radnju. Nema zbirne izmišljene cene ili statusa. Prve tri saradnje su vidljive, ostale na „Sve saradnje“; razlog aktivnog filtera ima prednost u sažetom prikazu. Otkazane i završene saradnje ostaju uz isti aktivni zadatak; cela grupa prelazi u istoriju kada nema aktivnih obaveza. Nepoznata veza ostaje zaseban zapis, nikad spajanje po naslovu. Izbor uloge, redosled hitnosti, potvrda, ocenjivanje, razlog otkaza i originalni privatni ID ostaju sačuvani. Proširenje se pamti kroz detalj/povratak i pozadinu, ali ne prelazi na drugi nalog. Native kompozicija liste, detalja i kanala još zahteva tačan novi APK.

### 16.11 AI — jedan mikrofon i završna kartica

Oba unosa koriste isti mikrofon: zadržavanje počinje slušanje, puštanje završava unos; pomeranje nagore otkazuje prema postojećem ugovoru. Pristupačan način „Govori bez držanja“ menja ponašanje istog mikrofona, bez zasebnog ekrana za glasovni razgovor. Transkript prikazuje stvarne delimične/završne reči u razgovoru; ne duplira ih u statusnom redu. Završeni unos prelazi u korisničku poruku i stvarno stanje čekanja/odgovora. Worker tok nema fotografije.

Kartica na kraju razgovora zahteva obavezne potvrđene činjenice, važeću cenu/osnovicu kada su potrebne, termine, pozitivan broj ljudi i sve potvrđene lokacijske tačke; bez greške, obrade ili blokade bezbednosti. Nepotpuni i napušteni razgovor ne prikazuju završnu karticu. Ručni pregled/uređivanje ostaje dostupan kroz postojeći meni.

**Još otvoreno:** redosled mapa → potvrđena lokacija → sledeće pitanje. Potrebna je veza sa ID-em činjenice/poruke i kanonskim readback-om, ne prepoznavanje teksta pitanja. Delimična ruta, „Kasnije“, skrivanje editora ili izgubljena potvrda servera ne smeju osloboditi sledeće pitanje. Trenutni paket kartice/mikrofona nije dokaz da je ovaj redosled već rešen.

**Naknadni SOURCE korak09.10:** implementirana barijera poznatih nastavaka preko receipt ID-eva/akcija i geografske činjenice. Mapa i njena pojašnjenja prethode odloženom pitanju; konačno pitanje dolazi posle potvrđene linije tek nakon kanonske potvrde svih tačaka i razrešenog ishoda. Metadata redosleda čuva se ograničeno u memoriji procesa, po nalogu/reviziji i stvarnom conversationId; izlazak i resume istog razgovora ne vraćaju pitanje iznad lokacije. Nema kopije teksta, adrese ili koordinata u toj memoriji. Pri promeni vlasnika brišu se i raniji vizuelni place/photo anchori.

Ograničenje: hladan povratak bez receipt metadata ne preklasifikuje staru istoriju. Causal fallback sme da odloži samo poslednji geo-producing nastavak posle poslednje korisničke poruke. Task odgovor sada čeka kanonski readback pre prikaza: sprečava bljesak narednog pitanja, ali još nema postepenog stream prikaza tog task odgovora. Worker-profile streaming nije menjan. Za istovremen pouzdan streaming i lokacijski redosled potreban je poseban raniji signal faze iz stvarnog ugovora, ne animacija lažnog odgovora. Native i stvaran provider dokaz ovog koraka ostaju otvoreni.

### 16.12 Veliki skupovi i dokaz opterećenja

Klijentski test pokriva 40.000 sintetičkih zadataka: po 4.000 u osam gradova Srbije, 4.000 na daljinu i 4.000 bez pina. Odvojeni test stvarnog adaptera proverava ograničen odgovor sa 256 grupa za 32.000 zadataka. Prvi proverava lokalni prikaz/grupisanje, drugi obradu serverskih markera; nijedan ne meri Supabase kapacitet, životni ciklus ili FPS.

Sledeći nivo koristi izolovanu bazu i stvarne ovlašćene RPC pozive za objavu, prijave, izbor, izmene, otkazivanje i prepisku. Izveštaj mora odvojiti populaciju od konkurentnosti, zahteve/s, p50/p95/p99, greške, čekanje na brave i granicu samog generatora. Ne opterećivati zajednički DEV sa 40.000 sintetičkih aktivnih korisnika. Postojeći Discovery-GRAD SQL harness iz istorije služi početnoj proveri čitanja; direktni seed sa isključenim triggerima nije lifecycle dokaz.

Izvori: [Airbnb pretraga i filteri](https://www.airbnb.com/help/article/39) služe kao referenca povezivanja izbora i rezultata. [k6 arrival-rate i dodela VU](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/arrival-rate-vu-allocation/) obrazlaže zašto brzina dolaska zahteva i broj potrebnih virtuelnih korisnika nisu ista mera. [Supabase performance](https://supabase.com/docs/guides/platform/performance) daje polazne provere upita i konekcija; ne potvrđuje kapacitet ove aplikacije.

**Runtime09.10:** [izolovani run37856499413](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/37856499413) PASS na93041f70;40.000 zadataka,2 Auth naloga,1 istovremeni zahtev. Podudarnost SQL/HTTP brojnosti, mapini članovi po viewportu, telo/ACL/zavisnosti/closure pre i posle merenja i teardown0 potvrđeni. Medijana toplog SQL: početna lista569,6ms, mapa460,6ms, grad366,2ms, tekst1986,2ms; HTTP medijane537/454/398/2027ms. Ovo identifikuje tekstualnu pretragu kao prioritet daljeg merenja/optimizacije; nije dokaz uzroka zastoja, simultanog kapaciteta ili korisničkog FPS-a. Precizni artifacti u evidence/discovery-baseline-40k-37856499413.

### 16.13 Fizička lista i merena pretraga —09.10

Telefoni66275774 i44e8eaff pokazali su navigaciju preko spuštenog sheet-a. Sama korekcija autoriteta položaja nije rešila native kvar. Nova kompozicija odvaja host koji pomera Discovery od unutrašnjeg bara sa sopstvenom navigacionom animacijom. Statična geometrija ostaje ista; završeno skriveno stanje uklanja i dodir/accessibility potomke. Vidljivost i dalje sledi fizički položaj: PEEK skrivena, HALF/FULL vidljiva, pin kartica skriva. Zastareli završetak animacije ne sme vratiti staro stanje. Ostali koreni ostaju u normalnom toku, detalji bez prostora za bar. Test koristi stvaran navigator i BottomTabBar; nije native dokaz. Tačan uzrok starog native resetovanja još nije konačno potvrđen. Preview dijagnostika je posebno uključena samo u QA buildu, ograničena na numeričke događaje bez sadržaja korisnika.

Izolovani profil run37858643191 je potvrdio40.000 formatiranja lokacije čak i uz filter grad+tekst. Sledeći eksperiment deduplikuje formatter po lokaciji unutar zahteva uz identičan odgovor i nezavisno poređenje na jedinstvenim lokacijama. To nije primenjena optimizacija niti dokaz40.000 istovremenih korisnika.


Eksperiment deduplikacije lokacije u run37861199898 je dokazao124 kompletna JSON baseline/candidate/revert poređenja za ponovljene lokacije, ali je potom pao na prvom HTTP pozivu. Brzina, jedinstvene lokacije i DEV primena nisu dokazani; novi run37863338193 čuva ograničenu dijagnostiku uzroka. Oba APK-a44e8eaff su instalirana sa -r i istim potpisom; telefon i dalje ima PEEK kvar. Sledeći objedinjeni APK mora dokazati zasebni host i grupisane Dogovore. Detaljan receipt ostaje CONTINUITY_FINISH_20261008.md.


**Naknadni fizički rezultat:** exact phone APK 6c755dff, run 37867659756, SHA `5fc1c0e61ce3948df36e922a9354b45d76eb4116f9dc86ed25757eb51e90e7e1`, uspešno ažuriran preko `adb install -r` sa istim sertifikatom i sačuvanom prijavom. Četrnaest zabeleženih native stanja dokazuje PEEK/pin bez tabova, HALF/FULL sa tabovima, dostupnu poslednju karticu, Back i povratak iz pozadine uz sačuvan pin/skrol. To prevazilazi gornji istorijski FAIL sa 44e8. Receipt: `evidence/native-phone-6c755dff/receipt.json`. Prekinuti gest i stvarni TalkBack nisu provereni; ovo nije opšti motion ili store PASS.

**Revidirane kartice posle kritike:** status prijave dobija sopstveni red ispod iznosa, tako da „Tražim ponude“ zadržava punu širinu i na 361 dp / font 1,15. Kratko „Tvoj“ ostaje uz iznos kad ima mesta. Dogovor sa predlogom na čekanju označava prikazani prihvaćeni iznos sa „Važeći iznos“, i kada predlog menja samo termin. Ne prikazuje predloženu cenu kao dogovorenu; nepoznat iznos ostaje nepoznat. Isti obrazac važi za pojedinačnu karticu i red osobe u grupisanom zadatku. Ove nove dorade tek zahtevaju svoj native dokaz.

**Vizuelna proba više ljudi:** postojeća interna galerija dobija `grouped-list`: jedan zadatak, četiri bilateralne saradnje sa različitim imenima, iznosima, stanjima i predlozima. Tri su odmah vidljive, četvrta kroz proširenje. Završena saradnja ostaje uz aktivni zadatak. Grupni i privatni prikazi koriste stvarne prezentacione komponente, ali fixture poslovne radnje su no-op; to dokazuje kompoziciju, ne pravo pristupa ili slanje. Na emulatoru proveriti stvaran font 1,15 i 1,3, dugačko ime i iznos, dostupnost poslednjeg reda i izbor kanala. Inicijali i ime stoje uz početak niza poruka bez ponovljenih zahteva za zaštićene fotografije.

**Merena granica servera:** concurrency run 37868724376 ima C1/C4 pune prozore od 60 s, ali C16 pada tokom zagrevanja sa pet HTTP500/57014; C32 nije pokrenut. Deljeni CI sa jednim viewer-om i 40.000 sintetičkih zadataka ne dokazuje 40.000 korisnika. Area split run 37871070145 proverava pun JSON po pojedinačnoj trojci baseline/kandidat/revert; rezultat je još otvoren. Ne povećavati timeout da bi se neuspeh pretvorio u prolaz. Detaljni brojevi i ograničenja ostaju u postojećem registru i continuity zapisu.


**Razgovori — nalaz i revidirana verzija:** emulator ea456 potvrđuje ime/inicijale za sačuvane privatne i grupne nizove. Lokalni niz poruka na slanju imao je propust; novi izvor daje isti identitet iz zadržane komande bez lažnog vremena ili potvrde. Potpis se ne ponavlja unutar istog niza i razdvaja se preko neučitane istorije. Grupni uvod postaje kratak pomoćni tekst; publiku i dalje jasno kaže birač kanala. Osvežavanje je mirna sekundarna radnja. Početno praćenje najnovije grupne poruke ostaje zaseban otvoren zahvat sa očuvanjem skrola i stvarnog readACK-a. Izmene tek čekaju svoj tačan native APK.


## Dopuna — grupni razgovor: poslednja poruka i učesnici bez pomeranja istorije

**URADIO:** početni prikaz prati dno tek kad postoji stvarno izmeren sadržaj/viewport. Dodir i čitanje istorije prekidaju praćenje; Starije poruke ne vraćaju dno, Najnovije ga izričito vraća. Keyboard/layout prati samo postojeći following režim. Lista ima nativni prepend anchor; scope je account/group/list generation. Učesnici i ovlašćeni pojedinačni Dogovori premešteni su u postojeći ProductSheet. Lista ostaje montirana; nema scroll-to-top ili slepog offset restore-a. Gubitak vidljivog anchor-a posle autoritativnog latest-page readback-a ima jasno objašnjenje, bez tihog spajanja starih podataka. Pristupačne akcije starije/novije imaju isti prekid praćenja.

**KRITIKA / REVIZIJA:** prvi predlog epoch callback-a uz native600ms odbijen je: stvarni FlatList wrapper prosleđuje odloženi native callback najnovijem props callback-u. Revidirano: native threshold60%/timer0, aplikacioni600ms dwell vezan za page/epoch/geometriju/mount/foreground/READY. Otvaranje učesnika ili private picker-a poništava timer; zatvaranje nad nepromenjenom geometrijom kreće punih novih600ms. Nema mark-all ili ACK iz scrollToEnd.

**DOKAZAO / SOURCE:**99 testova hook-a/grupnog ekrana/galerije/zajedničkog sheet-a PASS. Obuhvaćeni init, ručni skrol, backfill, latest, scope/background/staleRAF, overlay dwell, page replacement, empty page, accessibility i controller zaštite. Dva pada testnog mock-a otklonjena su (nedostajući RN Platform, potom eager native getter), nisu runtime greške. Završna TypeScript provera PASS.

**NIJE DOKAZANO / SLEDEĆE:** novi skrol još nije u APK-u512c740e koji se gradi. Nativni prepend/IME/TalkBack ostaju otvoreni. Mali skrol koji zadrži isti native viewable index set može konzervativno odložiti ACK do nove opservacije; to nije garantovan ACK600ms posle zaustavljanja i ostaje cilj native dorade. Ne menjati controller da bi se zadržale stare neautorizovane poruke.

Izvori: instalirani RN FlatList.js433–448 i ViewabilityHelper.js219–240; [React Native scroll anchoring](https://reactnative.dev/docs/scrollview#maintainvisiblecontentposition), [FlatList scrollToEnd](https://reactnative.dev/docs/flatlist#scrolltoend). Dokumentacija ne zamenjuje nativni dokaz.


### Revizija posle tačnog APK-a512c740e (9.10.)

Dogovori: Aktivni/Istorija ostaju mirna dva segmenta uz Raspored. Uloga je jedan horizontalni red sa punom dodirnom površinom i slovima; izabrana kapsula se otkriva nakon merenja, veliki tekst se ne skraćuje. Čeka tebe sada uz naslov kaže broj zadataka u tom skupu, ne bilateralnih saradnji. Istorija nudi povratak ka otvorenim obavezama iste uloge. Grupisani zadatak i dalje ima sve odvojene saradnje/uslove i njihove direktne ciljeve.

Početna: kada nema sledećeg termina, u prvom bloku Čeka te vodi stvarni naslov zadatka, pa konkretna radnja (npr.2 prijave · čeka tvoj izbor). I čitač ekrana koristi taj redosled. Bez naslova ostaju radnja i objašnjenje. Dva velika polja i sledeći prihvaćeni termin zadržavaju svoje mesto.

Nivo dokaza: ove dve revizije SOURCE149 testova+89guards/TSC, native sledeći paket. U prethodnom512 APK-u oba naloga/sesije očuvana, phone fullIME/lastmessage PASS i emulator4-person/125000/longname/pendingidentity1,15/1,3 boundedPASS. Inertna galerija ne dokazuje transport ili ovlašćenja. Detalji i granice su u postojećem CONTINUITY_FINISH i registru; release nije proglašen.


### Nativna dorada — broj mesta i naručilac na kartici (09.10)

Stvarni emulator512,361dp/1,15, pokazuje da bočni broj mesta odvlači širinu imenu i oceni. Revizija: broj mesta je zaseban red činjenica sa postojećim2.5D users28dp; naručilac zatvara karticu punom širinom, ime se ne skraćuje, zvezda i ocena ostaju zajedno. Sve postojeće činjenice, klik i čitački opis ostaju.139ciljanih+121guardtestPASS/TSC/source-review; ovaj raspored je poslea481 i još nije native prihvaćen. Dokaz problema: evidence/native-512c740e/taskcard-followup.json.


## Dopuna — izmeren efekat keširanja plana i ispravka instrumenta

**DOKAZAO / ACTUAL FAIL:** izolovani run37878921357/source40565dbc završioFAIL. Auto pet poziva2179,4/2217,3/2230,7/2291,1/2131,8ms pa šesti90s SQL57014; custom svih šest2486,8–2620,3ms; generic prvi90s57014. Svih11završenih odgovora odgovara oracle-u uz već navedenu validaciju/izuzimanje observationclock. Dva Auth,40.000zadataka,jedanSQLreader,bezHTTP i bezlifecycle. Readeridentity/cert/closure postflightPASS,teardown0. Originalni bounded artefakti i SHA: `evidence/discovery-plan-cache-37878921357/`.

**NIJE DOKAZANO:** oba instrumentirana poziva su42501 pre environment/sample, nema nativeplana. Efekat plan-mode važi za ceoRPC ihelpers; konkretan spori čvor još nije lokalizovan. Ne proglašavati ovaj FAIL uspešnom dijagnostikom ili performancePASS.

**REVIZIJA:** uklonjen suvišan privilegovaniLOADauto_explain; postojeći P6instrument već proverava preloadedGUC, zatim samoSETLOCAL. Ista ograda sada ovde,bezgrantova i menjanjauloga. Samo dozvoljene fazeADMISSION/CONFIG/CONFIGURED/ROLE/CALL ostajuuizveštaju; setuppermission/missingmodule odvojeni.17Node+6PythonPASS,5stvarnogeneratorSQLsesija/22PLpgSQLtelaPARSEPASS,read-onlyreview bezblokera. Ovo opravdava jedan korigovani izolovani runtime, sa istim90s/5s limitima.

**IZVOR:** PostgreSQL17 `src/backend/tcop/utility.c` i `src/backend/utils/fmgr/dfmgr.c` odbijaju ograničeniLOADpre provere već učitanogmodula. Pošto starierrorheadline nije sačuvan, tačna atribucijaLOAD-u je source-supported inference, ne posmatraniheadline.
