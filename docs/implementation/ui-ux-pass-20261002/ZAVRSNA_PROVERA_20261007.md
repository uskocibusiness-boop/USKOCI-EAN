# Završna provera sistema — 7.10.2026

**Šta je ovo:** objedinjen nalaz četiri provere naručene od vlasnika 7.10. („probaj tokove, opterećenje, radni profil, gde se pakuje Supabase, push, pin, mnogo pinova, filteri“). Provere su radile samo čitanjem: kod u `USKOCI-CLEAN-spoj-20261006` (glava 5340869b/1f7904fc) i DEV `leqcwgzvjsxugfgzdmth` kroz SELECT/EXPLAIN u transakcijama samo za čitanje. Ništa nije upisano na DEV. Agenti su radili na modelu Opus 5.5. Brojevi „node/jest“ nisu brojevi sa uređaja.

**Ispravka iste večeri:** kontrolna tabla je javljala da aplikacija zove tri funkcije kojih nema na serveru (`rpc_get_need_search_state`, `rpc_get_reopen_remaining_search_receipt`, `rpc_reopen_remaining_search`). To je bila greška zastarelog snimka (3.10.). Sve tri postoje na DEV-u; `docs/control/dev_snapshot.json` je osvežen 7.10. u 09:53 UTC (ledger 227, sertifikat 3a785d42 živ = overen, 254 rpc, 0 cron grešaka, `uskoci-ai-interview` v53). Tabla sada pokazuje 0 nedostajućih.

## 1. Radni profil, uparivanje, obaveštenja

**Gde živi profil:**
- **`app_profiles`:**
  - profil: veštine, alat, vozila, grad, radijus, država, „Mogu odmah“, status;
  - stara polja: licence, tim;
  - polja koja se ne koriste, a i dalje utiču na uparivanje: isključenja, minimalna cena, iskustvo.
- **`worker_match_preferences`:** približna tačka, zona i podešavanja ponuda.
- **Raspored:** `profile_availability_rules`/`windows` i kalendar Dogovora.
- **Pisanje:** `rpc_save_worker_ai_review` → `rpc_save_worker_location` / `rpc_save_worker_availability` / `rpc_complete_worker_profile`.
- **Klijent:**
  - `workerAiClientService.ts`, `locationClientService.ts` i `workerAvailabilityClientService.ts`;
  - `workerProfileClientService.ts`: ručna izmena ide direktnim UPDATE-om tabele.

**Kako stižu ponude:**
- **Novi zadatak:** objava ili izmena zadatka stavlja ga u red (`enqueue_on_need_change`). Cron svakog minuta (`dispatch_tick` → `dispatch_next_wave`) šalje talase [5, 5, 10, 20] radnika, najviše 40 po izmeni zadatka. Slanje staje posle 3 odgovora.
- **Već otvoreni zadaci:** čuvanje profila (AI pregled, lokacija, raspored) ponovo stavlja u red do 200 najnovijih otvorenih zadataka (`requeue_open_needs_for_worker_v5`). Zato rečenica na pregledu profila glasi „…o novim i već otvorenim zadacima…“.

**Razlike prema odluci vlasnika od 7.10.** (pravilo: vrsta posla + područje + vreme, alat i vozilo nikad uslov):

| # | Nalaz | Gde | Šta treba |
|---|---|---|---|
| G1 | Alat i vozilo su **tvrda zabrana** i za ponudu i za ručnu prijavu, uz +15 bodova za rangiranje | `private.match_detail_without_calendar` (L31/33/60/61/100), `dispatch_cheap_candidate_admitted` (L19/20) | serverski paket |
| G2 | Iskustvo (tvrdo) i minimalna cena su dodatni uslovi | iste funkcije | isti paket (vlasnik: „samo ta tri“) |
| G3 | Zadaci „bilo kad“ i „danas“ stižu **samo** radnicima sa „Mogu odmah“; nedeljni raspored se ne gleda, nema talasa za ostale. Na DEV-u: svih 9 otvorenih zadataka su tog tipa, a 27 parova je blokirano | `worker_dispatch_time_admitted` | **odluka vlasnika**, pa paket |
| G4 | Ne postoji serverski upit za „Za mene“; `rpc_discovery_v1` odbija nepoznat filter | — | serverski paket, pa prekidač |
| G6 | Ručna izmena veština ili alata ne stavlja otvorene zadatke ponovo u red | `workerProfileClientService.ts:114` | paket ili preusmeravanje na RPC |
| G7 | Obaveštenja su ograničena (40 po zadatku, staje na 3 odgovora) | `dispatch_next_wave` | samo ako vlasnik želi više |
| G8 | Neprimenjeni WPP02-A uvodi stvari koje je vlasnik odbio 7.10. | `supabase/candidates/worker-personal-v2-20261003/` | povući ga |
| G11 | Licence se i dalje mogu upisati sa klijenta | `workerProfileClientService.ts:23` | klijent |
| G12 | Svaki ponovni pokušaj upisuje STOPPED red (846 za 30 dana) | `dispatch_next_wave` | server, nizak prioritet |

Brojevi na DEV-u:
- **Profili i zadaci:** 5 aktivnih radnih profila, 9 otvorenih zadataka, 45 parova radnik–zadatak.
  - Ručna prijava je moguća u 36 parova, ponuda u 3, i sve 3 su već poslate.
- **Poslednjih 30 dana:** 10 OPPORTUNITY događaja.
- **Push:** 2 uređaja, oba neaktivna.

## 2. Mapa, pinovi, filteri, opterećenje

- **Pinovi:** P6 čitač (uključen u DEV build-ovima) crta pinove kao GL krugove. Nema bele kapsule, nema uvećanja od 6%, a narandžasti oreol je ispod drugih pinova.
  - Bela kapsula (`PricePill`) postoji samo u staroj putanji.
  - Grupisanje radi server (najviše 256 grupa); preklapanje pinova nema redosled crtanja.
- **Mapa ne pokazuje sve zadatke:** 4 od 9 otvorenih zadataka su „od tačke do tačke“, bez javne tačke, pa nikad ne stignu na mapu.
- **Lista:** njena oblast je ceo okvir mape, uključujući deo ispod liste. Izabrani pin se ne izvlači ispod kartice, a pomeranje mape briše izbor.
- **Čipovi filtera** se pojavljuju i nestaju dok pomeraš mapu, jer se računaju iz učitane strane, a ne iz serverskog odgovora.
- **Lista posle 100. reda** gubi podatke o objavljivaču.
- **Prazno stanje** još kaže da zadatke nudi profil, što je netačno posle odluke od 7.10.
- **Opterećenje klijenta** (node, ne uređaj):
  - Posle pomeranja: 47–68 ms p50 i 98–134 ms p95, isto pri 100, 500 i 2.000 zadataka, jer strana ima 50 redova.
  - Duboka lista od 400 redova: 200–240 ms p50, do 420 ms p95. Najveći deo je ponovno pretvaranje redova u kartice, 260–300 puta po pomeranju.
- **Opterećenje servera:** `rpc_discovery_v1` čita SVE otvorene zadatke pri svakom PAGE i MAP pozivu, a prostorni GiST indeks se ne koristi.
  - Cena po redu je oko 165 µs (dani, slotovi, pravo čitanja). Na 2.000 otvorenih zadataka to je oko 330 ms po pozivu, a pomeranje šalje dva poziva.
  - **Pre rasta broja korisnika potreban je serverski paket** (filter oblasti u prvom koraku i dani samo kad je zadat filter vremena).

## 3. Push obaveštenja

- **Šta radi:** ceo lanac postoji.
  - Na klijentu: dozvola, registracija uređaja, rotacija tokena, podešavanja i otvaranje posle dodira.
  - Na serveru: tabele, Edge `uskoci-push-transport` v22 i cron `uskoci_edge_workers` svakog minuta.
  - Jedno slanje 26.9. je stiglo na telefon.
- **Prekidač slanja je ugašen**, i to je potvrđeno: svih 360 odgovora u poslednjih ~6 h su `{"kind":"DISABLED"}`.
- **Šta fali:**
  1. Paket `rs.uskoci` (prodavnica) nema Firebase klijenta; postoji samo `rs.uskoci.preview`. **Vlasnik:** dodati aplikaciju `rs.uskoci` u Firebase projekat `uskoci-ed59b`.
  2. Obični build-ovi ne mogu da prime push: FCM je namerno ugašen svuda osim u posebnom build-u za dokaz. Potreban je novi APK (OTA to ne može).
  3. Na DEV-u nema aktivnog uređaja.
  4. Na DEV-u čeka 8 neposlatih push isporuka jednog naloga i 1 neproveren pokušaj od 26.9. Čim se slanje uključi, 7 bi otišlo odjednom. **Odluka vlasnika:** povući ih pre uključivanja.
  5. Paket za jedan uređaj nije na DEV-u, a njegova provera pre primene traži ledger 225 (sada je 227) i treba je osvežiti. Primena pomera sertifikat zatvaranja, pa traži „PRIMENI“ i ponovno overavanje.
  6. Push se šalje sa `ttl: 0`, pa telefon u mirovanju može da izgubi „novi zadatak“. Ispravka ide u isti paket.
  7. Dodir na obaveštenje uvek otvara Obaveštenja, osim kod poruka. To treba ispraviti zajedno sa push-om.
  8. Tekst „Izabran si“ ima gramatički rod, protivno pravilu 3.6.4.
  9. Ikonica u statusnoj traci nije podešena. Kanal ima običnu važnost, pa nema iskačućeg prozora.
  10. Dozvola se traži samo iz podešavanja, a ne posle prve objave ili podešavanja radnog profila.
  11. Profil `production` u `eas.json` pokazuje na DEV (R04 traži novi projekat). Nedostaju i prekidači Poruke, glasovne poruke i link za lozinku.

## 4. Tokovi i čet

- **Slike:** dva različita načina dodavanja (čet zadatka → poseban ekran, jedna po jedna; Dogovor → sopstvena fioka). Rad na jednom zajedničkom elementu je započet 7.10.
- **Cena i vreme:** na pregledu zadatka cena i način plaćanja se ispravljaju slobodnim tekstom. Rad na čipovima i polju za broj je započet 7.10.
- **HITNO:** još se video na kartici, pinu, u meniju zadatka i u podešavanjima. **Ugašeno 7.10.** jednim prekidačem (`EXPO_PUBLIC_URGENT`, nijedan build ga ne postavlja).
- **Zabranjen ili zatvoren nalog:**
  - Imejl prijava već ima poruku.
  - Fali poruka za telefonski kod, za link za lozinku, za tiho izbacivanje već prijavljenog i za nalog u zatvaranju (sada završi na Početnoj sa opštom greškom).
  - Rad započet 7.10.
- **Ekrani i obaveštenja:**
  - `mesto-zadatka` nema ulaz.
  - `poruke` u produkcijskom build-u nema ulaz (prekidač).
  - Svih 16 `dizajn-*` ruta je zatvoreno u samoj komponenti.
- **Dogovor čet:**
  - Slike rade, glas samo na Androidu.
  - Ponovno slanje je samo ručno; nema oznake pročitano ni „kuca…“.
  - Blokiranje nije dostupno iz same prepiske.
- **Radni profil:** rečenica bez ulaza („Približnu tačku možeš dodati u području rada.“) i suvišno „Proveri stanje razgovora“ posle čuvanja. **Ispravljeno 7.10.**

## 5. Šta sledi

**Klijent (bez servera), u radu 7.10.:**
- zajednički element za slike;
- poruke za zabranjen i zatvoren nalog;
- čipovi za cenu i vreme;
- popravke mape: kapsula pinova, izbor, oblast liste, keš, čipovi, prazno stanje.

**Serverski paketi (svaki na „PRIMENI <ime>“, posle dokaza na jednokratnoj bazi):**
1. **Pravilo uparivanja po odluci od 7.10.** (G1, G2, G3, G6): alat, vozilo, iskustvo i cena prestaju da budu uslov; „bilo kad / danas / odmah“ po odluci vlasnika; ručna izmena vraća zadatke u red.
2. **„Za mene“** (G4): jedno zajedničko pravilo za prekidač i za obaveštenja, plus novi ključ filtera u `rpc_discovery_v1`.
3. **Brzina i potpunost mape:**
   - filter oblasti preko prostornog indeksa;
   - dani se računaju samo kad je zadat filter vremena;
   - javna tačka za zadatke „od tačke do tačke“;
   - cena u grupi jednog zadatka (za kapsulu);
   - centar grupe.
4. **Push za jedan uređaj:**
   - osvežena provera pre primene;
   - TTL;
   - tekst bez roda;
   - ponovno overavanje sertifikata.

**Vlasnik:**
- Firebase `rs.uskoci`;
- `eas credentials` za FCM ključ;
- prekidači u Supabase panelu;
- odluka o 8 starih isporuka;
- odluka G3;
- prozor za telefon („sad“).
