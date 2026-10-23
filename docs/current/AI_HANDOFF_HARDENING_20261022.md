# USKOČI — AI stabilizacija i tehnička primopredaja, 22.10.2026.

## Granica ovog zapisa

Ovo je izvršeni razvojni paket sa proverama i svežim read-only pregledom DEV-a. Nije potvrda da je cela aplikacija spremna za javno izdanje. Jedini aktivni registar ostaje `docs/control/redovi.json`; ovaj dokument objašnjava konkretan paket i preostale uslove primopredaje.

Polazna objedinjena grana: `feature/unified-qa-master-20261017`, commit `fcef803e719ba5663f6cfd8fbd5a601e08a3479b`. Rad nastavlja postojeći PR #39, prvobitno `6c15647da07479ba5fbcc7ac0a6cbc9a681e6b95`. Implementacioni commit ovog kruga je `13de798231f16a6b3fc0e4261d9cf7c599a7a42c`. Nisu pravljeni novi proizvod, editor, matcher ili glavni plan.

## Šta je popravljeno

1. Task AI više ne prevodi upstream Gemini refusal u uspešan kanonski `BLOCK` razgovora. JSON, SSE i kataloški put prosleđuju neuspeh postojećem owner/attempt mehanizmu. Nema dopisivanja činjenica, završnog uspešnog odgovora ili automatskog ponovnog poziva. Pravi, validirani aplikacioni `safety: BLOCK` i dalje se primenjuje.
2. Stream sada odbija i eksplicitni `safetyRatings.blocked`, kao i `SPII`/`RECITATION` završetak, pre prihvatanja sadržaja. Nezaobilazna bezbednosna provera je ojačana, ne isključena. Log nosi kontrolisanu klasu greške, bez upstream teksta, identiteta ili tajni.
3. Zadržan je predlog različitih uloga iz PR #39: iskusan savetnik za obim zadatka naspram mentora za stvarne usluge radnika. Jedno pitanje ne sprečava prihvatanje svih nezavisno jasnih činjenica iz korisnikove poruke. Korisno razjašnjenje postojećeg opisa koristi `CLARIFY`, bez pretvaranja opcionog detalja u obavezno polje.
4. Uklonjena su redundantna presretanja koja su pravila lažnu trajnu blokadu. Nisu menjani SQL writer, potpisi, UUID pravila, Save/objava, geografija ili plaćanja.
5. Dve zastarele provere su usklađene: istorijski planner mora da odbije noviji izvor i kada prvo padne provera inventara; log test dozvoljava tačno jedan strogo oblikovan zapis trajanja, umesto odbijanja postojeće bezbedne telemetrije. Nijedan izvorni admission guard nije oslabljen.
6. Postojeći CI sada pokreće sve `supabase/proofs/ai/*.test.mjs`, uz najviše tri paralelna fajla. Izmene zajedničkih AI modula, AI provera i testne konfiguracije pokreću taj workflow.
7. Firebase probne konfiguracije čiste se u `finally` svakog poziva, i kada se probni paket odbije. Jest ne indeksira generisani `.expo` sadržaj kao drugu aplikaciju. Nisu menjani Firebase klijenti, aplikacioni identitet ili push enrollment.

## Izvršene provere

| Provera | Rezultat i granica |
| --- | --- |
| Puna mobilna regresija | 638/638 paketa; 14.415/14.415 testova; 3/3 snapshot-a. Prvi prolaz je imao upozorenje worker procesa; ponovljeni puni `--runInBand --detectOpenHandles` prolaz završio se exit 0 bez prijavljenih otvorenih handle-ova (638/14.415/3). |
| Sve AI Node provere | 709 ukupno: 708 PASS, 0 FAIL, 1 postojeći TODO. Tačan handler i zajednički moduli uz sintetički transport; nije živi Gemini dokaz. |
| TypeScript | PASS posle ispravke eksplicitnog tipa u safety proveri. |
| Firebase cleanup | 13/13 PASS, uključujući dozvoljene i odbijene pakete i stvarnu Expo konfiguraciju. |
| Integritet migracija | PASS, 186 fajlova; postojeći provenance status nije prepisivan. Nema SQL izmene. |
| Razvojne scene | PASS: nema Expo proizvodnih ruta ili runtime uvoza razvojnih scena. |
| AST pregled klijenta | 670 TS/TSX modula, od toga 441 prezentacioni. Dva nalaza direktne mreže odnose se na javni map style i razvojni map probe; nisu dokaz curenja tajni. Nisu dodavani lažni izuzeci u auditor. |
| Novi GitHub CI | Čitati konačan status na PR #39 za commit `13de7982`; lokalni uspeh nije automatski remote uspeh. |

## Sveže potvrđeni uslovi DEV-a

Projekat: `leqcwgzvjsxugfgzdmth`. Pre ovog paketa aktivni su Task121, Worker76, Push37. Kandidat menja samo entrypoint i `geminiTaskStream.ts` u svakom AI paketu; ostale relativne zavisnosti ostaju iste. Status eventualne primene i readback navode se u završnom dodatku, odvojeno od ove polazne činjenice.

- `retention_ai_source_ready() = false`; `closure_erasure_binding_v5()` je prazan. Brisanje naloga je stvaran release uslov; prepisivanje sertifikacionog hash-a nije popravka.
- `legal_document_versions`: 0 redova. Ovo ne dokazuje da ne postoje tekstovi na sajtu, ali nedostaje ovaj serverski paket pravnih verzija.
- Aktivno odobrenih AI test naloga: 8. Testni limit je 5 USD, njegovo sprovođenje je isključeno, cenovnik važi do 01.01.2027. Polje rezervisanog iznosa oko 55,35 USD nije račun provajdera.
- Dispatch i dalje koristi `mode=ALL`, ceiling 10.000, dnevnu kapu 1.000. To nisu izmerene isporuke korisniku. Odluka o primerenoj učestalosti mora pratiti deduplikaciju, preference i stvarnu betu.
- `TRUNCATE` grantovi: 17 tabela za `anon`, 19 za `authenticated`. Potreban je precizan pregled dostupnih puteva i opoziv nepotrebnih privilegija; nije dokazana daljinska eksploatacija.
- `rpc_closure_api_guard` je potvrđeno podešen kao PostgREST pre-request hook na `authenticator` ulozi. Zbir njegovih poziva nije dokaz zasebne klijentske petlje; poreklo velikog prometa i dalje zahteva merenje.
- Cron istorija je preko 133.000 redova. Potreban je rok čuvanja i održavanje, bez brisanja korisnih revizionih dokaza.
- Advisori: 93 FK bez pokrivajućeg indeksa, 18 RLS initplan upozorenja, 5 grupa više permisivnih politika. To nisu automatski 116 korisničkih kvarova. RLS bez politika u privatnim tabelama može biti namerna zabrana direktnog pristupa.

## Matrica scenarija za primopredaju

Za svaki red prati se isti lanac: izjava → Gemini fact → tipiziran nacrt → potpisan pregled → server upis → kartica → matching → dispatch/push. Nema proglašavanja celog reda završenim na osnovu samog prompta.

| Scenario | Šta već postoji / šta je provereno u ovom krugu | Preostali dokaz |
| --- | --- | --- |
| Krečenje i smislen obim | Odvojena uloga i test jednog scope razjašnjenja; očuvanje nezavisnih činjenica | Živi razgovor, kultivisan opis i pregled bez ponavljanja |
| Popravka kod majstora | Zajednički service execution/handoff ugovor; AI regresija | Potpisan Save i matching bez lažnog pina radionice |
| Selidba dva grada | Tipizirana ruta i postojeće map provere | Oba potvrđena pina, objava i relevantan radnik |
| Više stanica | Slotovi tačaka i tipizirana geografija | Promena jedne stanice bez zamene drugih |
| Pin premešten u drugi grad | Odvojeni semantički podaci i potvrđene koordinate | Usaglašavanje javnog grada, opisa i potvrde; nije popravljeno ovim paketom |
| Subota od 9 | Postojeći start-only ugovor i regresije | Stvarni razgovor → objava, bez izmišljenog kraja |
| Do kraja meseca | Razlikovanje fleksibilnog raspona od fiksnog višednevnog rada | Rok izvršenja u kalendaru i matchingu |
| Fleksibilno do petka | Ograničen fleksibilni raspon i vremenski guard | Živi potvrđeni zapis i relevantna dostupnost |
| Do petka, samo posle 15h | Tekst i deo vremenskog ugovora postoje | Jedinstven strukturirani ugovor za rok i dnevno ograničenje; otvoreno |
| Prijave do nedelje, posao u utorak | Opcioni fact/kandidat postoji iza zasebnog flag-a | Set/change/clear kroz edit writer i potpisani tok; ne uključivati samo flag |
| 100 evra | Guard sprečava direktan EUR→100 RSD predlog | Atomska invalidacija stare prihvaćene RSD cene i živi pregled |
| Ponude / tipfeler | Strogi typed price mode, očuvanje nezavisnih činjenica | Živi jezički primer; provider refusal više nije razlog za trajni BLOCK u kandidatu |
| Radnik sa više usluga | Kontrolisana klasifikacija, cross-mode regresije i binding | Potpisan Save svih usluga/mode-ova, oblast i stvarni matcher |
| Slična postojeća usluga | Catalog/reuse i identitet u regresijama | Živi reuse istog UUID-ja, bez duplirane grane |
| Objava do Dogovora | Postoje delovi i raniji datirani dokazi | Novi dvostrani E2E, isporuka/tap na pravi cilj, izbor, čet i završetak |

## Čišćenje bez oštećenja proizvoda

Primenjeno je ciljano čišćenje pogrešnog error toka, redundantnih catch grana, zastarelih testnih očekivanja i privremenih Firebase fixture-a. Nije rađeno masovno brisanje tabela, migracija, funkcija, Vault tajni ili istorijskih dokaza.

Kandidati koji traže zaseban dokaz: stari inline fact editor helper-i u `aiNeedV2Ui.ts` (trenutno pretežno testni pozivaoci, dok aktivne površine koriste formatiranje i isti AI razgovor); razvojne Edge probe i `sbfenv`; stari RPC endpoint-i; razvojni snapshot-i i cron istorija. Prisustvo `v2`, `dev` ili prazne tabele nije dovoljno za brisanje. Za server objekte proveriti closure/export katalog, pozivaoce i povratak pre uklanjanja.

## Uslovi za predaju kao finalne aplikacije

1. Autentifikovani QA razgovori nad tačno primenjenim paketom: normalan unos, korekcija, refusal/oporavak, oba pregleda, Save/objava i readback. Povezan administrativni čitalački pristup nije korisnički JWT. U ovoj radnoj kopiji nema spremne QA sesije ili lokalnog Auth okruženja; nije proizveden lažni signed/provider dokaz.
2. Zatvoriti vremenski/dnevni ugovor, invalidaciju lokacije i cene, rok prijavljivanja i stvarni per-service/area readback tamo gde scenariji pokažu prekid.
3. Završiti i dokazati izvoz/brisanje naloga i retention, pravne verzije i prihvatanje, AI pristup/budžet i najmanje privilegije.
4. Dva naloga i stvarni uređaji za matching/push/tap, prijavu, izbor, Dogovor, privatni/grupni čet, otkaz/zamenu i završetak. U ovoj sesiji nema `adb` ili povezanog emulatora/telefona.
5. Izgraditi APK iz konačnog proverenog commita; potvrditi hash, runtime/OTA i instalirani izvor. Istorijski uspešan build/OTA za `fcef803e` ne sadrži ovaj novi paket.

Ovo su tehničke granice dokaza, ne zahtev za novo odobrenje rutinskog rada. Javna objava i produkcija nisu proglašene spremnim.

Mašinski dokaz: [AI_HANDOFF_HARDENING_20261022.json](evidence/AI_HANDOFF_HARDENING_20261022.json).

## Završni DEV rezultat ovog kruga

- GitHub: implementacioni commit `13de798231f16a6b3fc0e4261d9cf7c599a7a42c`; svih šest prijavljenih CI workflow-a SUCCESS. [Kompletna TypeScript/AI/mobile provera](https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/39831787791).
- DEV: **Task AI v122 ACTIVE**, **Worker AI v77 ACTIVE**. Potpuni readback: **20/20** i **19/19** fajlova odgovara implementacionom izvoru uz normalizaciju preloma redova. U svakom paketu su u odnosu na prethodnika promenjeni samo entrypoint i zajednički stream modul.
- Oba javna endpoint-a bez prijave vraćaju **HTTP 401**. `verify_jwt=false` ostaje prethodno podešavanje jer oba handler-a sama proveravaju korisnički Auth i vlasništvo; nije uklonjena autentifikacija.
- Nema SQL migracije, promene AI budžeta, pravnih podataka, korisničkih razgovora ili naloga, slanja push-a ili produkcionog deploy-a. U ovom krugu nije pozvan Gemini.
- Osvežen je postojeći DEV katalog: **288 RPC imena, 193 izvršiva za authenticated**. `rpc_resolve_activity_application_v1` zaista postoji; prethodni alarm je bio zastareo snapshot. Nedostaju samo dva opcionalna deadline kandidat RPC-a, čiji ceo tok ostaje neaktiviran/nepotvrđen. Ostale sekcije snapshot-a nisu proglašene svežim ovim delimičnim osvežavanjem.
- Novi APK i OTA nisu pravljeni u ovom krugu. Promene AI ponašanja su na serveru, iza postojećih endpoint-a. Aktuelni paket ima DEV/source/CI dokaz; još nema novu autentifikovanu Gemini i uređajsku potvrdu.

PR #39 je spojen u zajedničku granu `feature/unified-qa-master-20261017` kao `e629f4495ac8d89418f4e8d3899e220ff826ba37`. Aktivni DEV paket odgovara kodu iz spojenog PR-a. Ovaj merge ne predstavlja novi APK, OTA ili provider/uređajski dokaz.
