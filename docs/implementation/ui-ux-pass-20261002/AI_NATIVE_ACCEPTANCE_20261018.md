# Ograničen AI test — IZVRŠEN 18.10.2026. sa nalazima

**Naknadni status:** vlasnik je odobrio ovaj ograničeni test. Iskorišćeno je svih šest poziva; tri task i tri worker odgovora su upisana. Pronađene su greške završetka task handler-a, Auth poruka i worker retry kontrole, kao i otvoren raskorak alias/ID klasifikacije. Obuhvat nije uključivao objavu, Save, matching ili push. [Rezultat i granice](AI_NATIVE_RESULT_20261018.md), [strukturisani dokaz](AI_NATIVE_RESULT_20261018.json). Dozvola za dalje plaćene pozive nije preostala.

Tekst ispod je sačuvani predlog scenarija pre izvršavanja; formulacije „predlog“ i „traži odobrenje“ odnose se na taj raniji trenutak.

Ovo su sintetički ulazi za proveru upravo objavljenih instrukcija, uz postojeći plan. Nisu transkript korisnika, dokaz prolaza ili odobrenje za plaćeni poziv.

## Obuhvat predloga

- Isti provereni emulator APK, kanonski DEV `leqcwgzvjsxugfgzdmth` i već prijavljen testni nalog.
- Najviše 6 tekstualnih poziva Gemini 3.8 Flash, bez govornog provajdera. Kod rezerviše do 0,25 USD po LLM pozivu: ukupna granica rezervacije ovog predloga je 1,50 USD. To nije procena stvarne obračunate cene.
- Dve odvojene probne niti, po najviše 3 poruke: zadatak i radni profil. Dozvola mora obuhvatiti njihove DEV zapise razgovora/klasifikacionog konteksta i evidenciju potrošnje koje postojeći tok pravi.
- Bez objavljivanja zadatka, Save/aktivacije profila, slanja push-a, izmene kataloga ili ručnog menjanja baze.
- Za svaki pokušaj jedan zahtev. Posle neizvesnog ishoda prvo pročitati postojeće stanje; ne slati novi plaćeni zahtev samo zato što odgovor kasni.

## Zadatak — remote izrada i fizička predaja

1. „Treba mi izrada 3D figurica. Izrada je kod izvršioca, a figurice bih preuzeo u Novom Sadu ili dogovorio slanje.“
   - Očekivanje: razlikuje mesto izrade od predaje; ne pretvara ovo automatski u ON_SITE kod naručioca. Ne izmišlja količinu, materijal, budžet ili rok.
   - Ako nedostaje više bitnih podataka, može ih grupisati u do tri kratka povezana pitanja. Nije obavezno da uvek pita tri.
2. Odgovoriti samo na deo stvarno postavljenih pitanja, uz korisnikovu raniju odluku da detalji ostanu otvoreni: „Detalje izrade bih dogovorio sa izvršiocem. Preuzimanje u Novom Sadu mi odgovara.“
   - Očekivanje: zadržava postojeće činjenice i ne ponavlja već odgovoreno. Opcione nepoznate detalje ne prikazuje kao potvrđene.
3. „Ipak bih slanje umesto preuzimanja. Izrada je i dalje kod izvršioca.“
   - Očekivanje: menja način predaje u nacrtu, uz očuvano remote izvršenje. Ne traži tačnu privatnu adresu kao uslov za remote klasifikaciju i ne obećava objavu ili pronađenog radnika.

## Radni profil — delimičan odgovor i korekcija

1. „Bavim se 3D štampom. Predmete izrađujem kod sebe i dogovaram slanje ili preuzimanje.“
   - Očekivanje: predlaže odgovarajuću uslugu i režim, uz očuvanje potvrđenih podataka postojećeg profila. Slične nazive ne predstavlja kao dokaz više različitih kompetencija.
2. Odgovoriti na najviše jedno stvarno postavljeno pitanje. Ako je razjašnjenje režima potrebno: „To radim na daljinu; preuzimanje može biti u Novom Sadu.“
   - Očekivanje: čuva delimičan odgovor i ne dopunjava ostala pitanja iz mašte. Grad preuzimanja ne postaje automatski područje terenskog rada.
3. „Ne želim sada da dodajem alat ni vozilo. Ostalo ostavi kako jeste.“
   - Očekivanje: oprema ostaje opciona; odsustvo novog podatka nije nalog za brisanje prethodno sačuvanog. Ne tvrdi da je profil već sačuvan ili aktiviran sa novim izmenama.

Ako model traži neočekivan stvarni podatak, ne izmišljati ga u ime korisnika. Zabeležiti vrstu nedostajućeg podatka i zaustaviti taj scenario ili tražiti odgovor vlasnika. Ne menjati scenario radi lepšeg prolaza.

## Dokaz i granice

Sačuvati lokalni, privatni dokaz UI stanja i strukturisani rezultat provere po koraku: izvršeni broj poziva, verzije Edge funkcija, source/flags/APK, ponašanje delimičnog odgovora i korekcije, očekivano/stvarno. Sirovi razgovori ne idu u javni Git repozitorijum.

Čak i potpuni prolaz ovih šest poruka ne potvrđuje Save/binding, novu granu, regionalnu pokrivenost, matching između dva naloga, push ili account closure. Za te tokove ostaju zasebni dokazi postojećeg plana. Plaćena provera traži izričito odobrenje prema AGENTS.md §3.1.6 i odgovarajući DEV obuhvat prema §3.1.8.
