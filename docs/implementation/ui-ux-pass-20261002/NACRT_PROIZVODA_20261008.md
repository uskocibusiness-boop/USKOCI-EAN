# Nacrt proizvoda USKOČI — svaki ekran, ulaz, filter, komanda i tok (8. 10. 2026)

**Šta je ovo.** Odgovor na vlasnikovo pitanje (8. 10.): „da li si osmislio kako će svi ti ekrani da izgledaju… ne samo boje i font, nego i sama kompozicija, nešto doda, oduzme, napravi drugačije, drugačiji ulaz, prikaz, filter… neki filter koji je falio ili je bio nepotreban, ulaz ili komanda uvezana kroz tokove… kao pravi produkt arhitekta kompletnog proizvoda“. Ovo je PREDLOG arhitekture celog proizvoda; vlasnik ga gleda kao skice na platnu „Nacrt proizvoda USKOČI“ (https://claude.ai/artifact/6fzbWbjPoRbhKP19d9edX1) i kaže da/ne po ekranu. Ništa ovde nije odobreno samim zapisom. Pravila J1–J15 i dijagnoza: `ANALIZA_EKRANA_TELEFON_20261008.md`. Vlasnikovi izbori sa table (`IZBOR_VLASNIKA_20261008.md`) i zaključani delovi (ulaz V4.9, dve velike pločice Početne) ostaju.

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

**R2 Pregled pre objave.** Naslov; redovi činjenica sa vrednošću, svaki › otvara list sa jednim poljem: Šta · Gde · Kada · Iznos · Ljudi · Fotografije · Opis; ⓘ „Ko šta vidi“; dno: „Objavi zadatak“ (izmena: „Potvrdi izmene“). Nacrt se ne briše tiho: „Obriši nacrt“ crveno na dnu.

**R3 Moj zadatak.** Gore: nazad, „Izmeni“ (vidljivo). Blok stanja: „Još nema prijava“ ILI lica (do 3) + „3 prijave“ + jedino zeleno „Pogledaj prijave“; činjenice (iznos/„Tražim ponude“, mesto, vreme, ljudi > 1); opis; Pitanja (1 novo) › — odgovaraš ovde; mesto; „Objavljen pre 2 sata“; dno: „Otkaži zadatak“ crveno (potvrda u listu). Uklanja se: „Čekaš prijave. Vidiš ih ovde i u zvoncu.“, „Dogovoreno 0/1“, „⋯“ kao jedini put.

**R4 Prijave (izbor osobe).** Naslov zadatka gore; redosled: Najniža cena · Najbolja ocena · Najranije **[server ili cela lista]**; kartica ponude: lice, ime, ★ i broj ocena, iznos desno, „Može: sub 10–14“, poruka (2 reda), „Izaberi“; izbor → list sa sažetkom i „Izaberi osobu“ → „Dogovoreno!“ (dva lica i naslov, vlasnikov izbor C) → Dogovor.

**R5 Moji zadaci.** Grupe po fazi (vlasnikov izbor A): Čeka tvoj izbor (lica) · Objavljeno · Dogovoreno; redovi Nacrti (1) i Istorija; red: naslov, stanje, broj prijava. Prazno: papir sa pinom + „Objavi zadatak“.

### Zajedno

**Z1 Početna.** Znak, zvono, lice; dve velike pločice (zaključano); „Sledeće“: krupno vreme sledećeg Dogovora („Danas u 14:00“, naslov, sa kim) samo kad postoji (izbor B); „Čeka te“ najviše 3 (radnja + naslov zadatka, bez treće rečenice); redovi Moji zadaci (8 aktivnih · 1 nacrt) i Moje prijave (1 čeka odgovor); „Mogu odmah“ (samo sa aktivnim radnim profilom, isto ime svuda). Uklanja se: slab red rasporeda, „Slobodan sam sada“, duple rečenice.

**Z2 Dogovor — Pregled.** Gore: nazad, lice + ime + uloga („Traži pomoć“ / „Uskače“), zvono; tabovi Pregled · Poruke; naslov; koraci kratko: Dogovoreno · Gotovo · Potvrđeno · Ocena (nikad prelomljena reč) + ⓘ „Kako ide do kraja“; kartica sledećeg koraka sa jedinim zelenim dugmetom („Predloži termin“ / „Zadatak je gotov“ / „Potvrdi završetak“ / „Oceni“); činjenice: Kada (po vremenu u Srbiji), Gde = tačna adresa (samo u Dogovoru) + „Otvori u mapama“ (spoljna mapa, bez plaćenog ključa), Iznos; vidljivi redovi: Izmeni uslove, Prijavi problem; odvojeno crveno: Otkaži Dogovor, Prijavi ili blokiraj osobu. Dodaje se: „Otvori u mapama“, kartica sledećeg koraka. Uklanja se: „⋯“ kao jedini put, dve rečenice objašnjenja.

**Z3 Dogovor — Poruke.** Razgovor; glasovna poruka drži-i-pusti (šalje na puštanje); fotografije; poruke sistema (termin predložen, gotovo) kao tihe oznake u toku razgovora.

**Z4 Dogovori.** Aktivni · Istorija + ikonica kalendara (Raspored, jedini ulaz); kartica: naslov, sa kim (lice), sledeći korak ili termin; Istorija: filter Svi/Završeni/Otkazani (postoji).

**Z5 Raspored.** Nedelja sa tačkom ispod dana koji ima Dogovor; dan: Dogovori sa vremenom; odeljak „Termin još nije dogovoren“ sa „Predloži termin“; dno: Moja dostupnost ›, Arhiva ›. Samo Dogovori (bez mojih objava i prijava), jedan izraz „Fleksibilno“.

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
