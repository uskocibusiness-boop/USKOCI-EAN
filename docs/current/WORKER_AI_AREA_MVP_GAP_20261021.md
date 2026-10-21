# Radni AI: prirodno područje rada bez ručnog pina — ugovor za sledeći serverski paket

**21.10.2026.** Ovo je lokalni pregled izvora i predlog ugovora. Nijedna promena iz ovog dokumenta nije primenjena na DEV/prod. Korisnikov cilj je da kaže gde prihvata posao običnim jezikom, a da aplikacija postavi samo neophodno dopunsko pitanje i sama pripremi potvrdivo područje. Kućna adresa, trenutni GPS i ručno pomeranje početnog pina nisu ulaz u radni profil.

## Stvarno stanje i dokaz

| Tvrdnja | Dokaz | Posledica |
| --- | --- | --- |
| Worker AI strukturira jednu državu, grad i radijus. | `supabase/functions/uskoci-worker-interview/index.ts:85,156–159`; `src/data/workerAiClientService.ts:77–96` | „Vojvodina“, „cela Srbija“ i dva grada mogu se razumeti u razgovoru, ali ne mogu postati istinita aktivna geografska pokrivenost. |
| Radijus je 1–200 km, a promena grada kroz AI briše staru približnu tačku. AI ne sme predložiti koordinate. | `supabase/migrations/20260912220506_clean_v5_owned_worker_profile.sql:125–144` | Novi AI opis grada se čuva bez centra dok nema zasebne potvrde. |
| Review/save upisuje baš jedan objekat `location` i alat/vozilo iz celog signed candidate-a. | Ista migracija, `rpc_prepare_worker_ai_review` i `rpc_save_worker_ai_review`, redovi približno 358–437 | Samo vizuelno skrivanje opreme u završnom pregledu ne bi bilo poštena potvrda upisa. Zato se postojeća neispražnjena oprema tamo privremeno vidi. |
| On-site matcher bez približnih koordinata prihvata samo istovetan grad i državu; sa koordinatama meri rastojanje do jednog centra. Remote grana je nezavisna. | `supabase/migrations/20261019104604_service_handoff_signed_matching.sql:1720–1734` | Sakriti jedini sadašnji put potvrde centra pre zamene bi ukinulo povezivanje sa okolnim mestima. Trenutna potvrda tačke ostaje rezervni put, nije obavezna za čuvanje profila. |
| Saved profile već otvara korekciju područja kroz isti AI razgovor; ruta `/profil/lokacija` je compatibility entry, `mode=point` zasebna potvrda. | `src/ui/workerProfile/WorkerProfileSaved.tsx`; `src/ui/workerProfile/WorkerAiTopicEntry.tsx`; `src/app/(app)/profil/lokacija.tsx` | Raspored treba evoluirati oko AI razgovora, ne uvoditi drugu ručnu formu za grad/radijus. |

Ovaj pregled je iz izvora. Ovaj paket nije ponovo izvršio on-site geografski tok na živom serveru niti na HONOR telefonu.

## Jasna semantika iskaza

| Šta osoba kaže | Šta AI može da uradi danas | Cilj nakon Area V2 |
| --- | --- | --- |
| „Novi Sad, do 30 km“ | Zabeleži `RS` samo ako je država potvrđena, `Novi Sad`, `30`. Bez centra matcher van istog grada ne radi. | Jedan potvrđeni lokalitet sa 30 km i automatski razrešenim približnim centrom. |
| „Novi Sad i okolina“ | Ne sme izmisliti kilometre; pita „Koliko daleko ti odgovara?“ | Isto, uz jedno kratko pitanje ako opseg nije jasan. |
| „Novi Sad i Beograd“ | Ne sme prećutno zameniti dve oblasti jednim krugom. | Dva nezavisno potvrđena lokaliteta, svaki sa svojim opsegom ili eksplicitnim „samo grad“. |
| „Cela Vojvodina“ | Saopšti da trenutni matching to ne podržava. | Potvrđena administrativna oblast iz održavanog gazetera i njene granice. |
| „Cela Srbija“ | Saopšti ograničenje; ne predstavljati 200 km kao Srbiju. | Potvrđena država RS kao on-site pokrivenost. |
| „Balkan“ | Pita koje konkretne države; ne izmišlja spisak. | Skup imenovanih, podržanih država, svaka potvrđena. |
| „Samo onlajn“ | Remote usluge bez zahteva za putnim radijusom. | Isto; pravilo predaje fizičkog predmeta proverava se odvojeno od on-site teritorije. |

## Izvediv Area V2 ugovor

1. **Vokabular.** `areaKind = LOCALITY_RADIUS | ADMIN_REGION | COUNTRY`, država, autoritativni `placeId`, korisniku čitljiv naziv, potvrđen izvor geokodera/gazetera, `radiusKm` samo za lokalitet i gruba geometrija za matching. Niz je ograničen brojem i veličinom; izbegava se proizvoljan slobodan poligon i privatna kućna tačka.
2. **Razrešenje.** AI vraća mesta koja je korisnik rekao, ali ne proizvoljne koordinate. Server/poverljiv resolver razrešava nazive u podržane lokacije. Klijent prikaže izbor samo kad su mesta dvosmislena. Za jedan jasan lokalitet prikazuje se naziv i približan centar u završnom pregledu, bez obaveznog drag pina. Korisnik potvrđuje ceo pregled. Netipičan ili nedostupan gazeter ne postaje aktivna pokrivenost.
3. **Signed review.** `rpc_prepare_worker_ai_review` mora uključiti svih `areas[]`, način rada po usluzi, razrešene place ID-eve, status potvrde, verziju gazetera i digest. `rpc_save_worker_ai_review` transakciono upisuje samo potvrđene oblasti; sačuvano i aktivirano ostaju odvojene odluke. Izgubljen odgovor se čita po istom conversation/review ID-u.
4. **Matcher.** Za on-site zadatak koristi OR kroz potvrđene oblasti. `LOCALITY_RADIUS` meri od provereno razrešenog centra; `ADMIN_REGION/COUNTRY` proverava stvarnu administrativnu pripadnost približnog javnog mesta zadatka. Nema proseka centara niti unije „jedan veliki radijus“. Za `REMOTE` teritorija ne blokira, ali potpisana predaja/slanje ostaje zaseban uslov. Ne otkrivati privatnu adresu zadatka u ovoj operaciji.
5. **Kompatibilnost.** Postojeći `city/radius/approximatePosition` ostaje čitljiv dok se stari profili ne prebace uz korisnikovu potvrdu. Novi niz oblasti se uključuje tek za profil sa Area V2 receipt-om; ne smeju istovremeno dve različite istine za push, „Za mene“, prijavu i javni profil. Revision i account ownership se proveravaju pri svakom čitanju/upisu. Requeue otvorenih zadataka posle promene područja mora biti idempotentan.
6. **Oprema u MVP-u.** Sačuvan profil i živi AI nacrt ne ističu alat/vozilo. Stari signed Save ih i dalje upisuje, pa se neispražnjeni podaci moraju videti u završnom pregledu dok nova serverska verzija ne prestane da ih menja ili ne obezbedi izričitu politiku očuvanja. Ne brisati ranije korisničke podatke implicitno.

## Gates pre uklanjanja rezervne mape i puštanja u rad

- Schema/RPC/matcher/push projekcija koriste istu listu oblasti i istu verziju; readback dokazuje da je područje aktivno.
- Probati iz oba ugla: dva grada, region, država, korekcija samo jedne oblasti, `Novi Sad i okolina` bez kilometara, dvosmislen naziv, promena države, remote bez putnog radijusa, neuspešan resolver i mrežni prekid.
- Dokazati da `Novi Sad + Beograd` prima relevantan zadatak u oba grada, odbija treći; da Vojvodina/Srbija ne nastaju iz biografije; da preklapanje oblasti ne šalje dupli push.
- Potvrditi pristupačnost izbora mesta, povratak u isti razgovor, nacrt naspram sačuvanog, i puni HONOR native prolaz. Tek tada ukloniti `mode=point` iz običnog toka i odgovarajuće stare tekstove/testove.

**Status:** predlog funkcionalne izmene C. Trenutni AI razume izraze, ali sadašnji backend ne ume da ih sve pretvori u pokrivenost. Nije pripremljena migracija za automatsku primenu: izvor i verzija granica/gazetera, ograničenja države i postojeći dispatch/push ugovori moraju se prethodno izabrati i testirati zajedno.

## Lokalna zaštita V1 kandidata, 21.10.2026. — samo izvorni kod

Helper je sada u `supabase/functions/_shared/workerAreaAdmission.mjs` i povezan sa lokalnim izvorom `uskoci-worker-interview` posle validacije provider izlaza, pre upisa AI reda. Testovi u `docs/candidates/worker-area-v2/` ostaju lokalni dokaz. Za prepoznate iskaze o celoj Srbiji, regionu, koridoru ili više gradova uklanja predlog promene jednog `location` objekta i geografski obojenu javnu biografiju; nezavisna rečenica biografije ostaje kada se može odvojiti. Za novi grad sa „okolinom” bez kilometara traži razdaljinu; odbija predloženi radijus različit od izgovorenog. Bez potvrđenog centra ne obećava automatske predloge iz okolnih mesta. Čuva zasebno pitanje o nedostajućem terminu. `REVIEW`/`BLOCK` ostaju zaključani. Nema DEV objave; na stvarnom serveru i u APK-u ponašanje je nepromenjeno.

Alat/vozilo još nisu uklonjeni iz aktivnog radnog AI toka. Kandidat je isprobao izbacivanje novih predloga, ali je aktivni Edge vraćen na prethodni izvor zbog nedovoljno pouzdane semantike područja. Trenutni `rpc_save_worker_ai_review` i dalje upisuje opremu iz celog signed kandidata. Da bi alat/vozilo nestali iz upisa bez brisanja ranije sačuvanih vrednosti, potreban je zaseban RPC ugovor i migracija signed kandidata/review-a; pregled mora istinito pokazati stare vrednosti dok Save može da ih piše.

Ovo je **samo lokalni Edge izvor i sintetička provera**, bez DEV objave, migracije, novog signed review polja ili promene matchera. Nije Area V2 i ne proširuje aktivnu pokrivenost. Naknadna revizija je ispravila sedam lokalno reprodukovanih slučajeva: samo onlajn opis više ne menja postojeći Niš; nova „okolina Beograda” bez kilometara ne prisvaja stari radijus; zaseban onlajn opis Srbije ne potiskuje izričit terenski Novi Sad; dodatni izrazi za celu Srbiju/koridor se odbijaju kao V1 krug; iskustvo odvojeno zarezom ostaje u biografiji; dva lična imena ne postaju dva grada; i „nije 30 km, nego 50 km” koristi ispravljenih 50 km. Sledeća nezavisna revizija je reprodukovala i lokalno zatvorila dodatne blokere: modelov Beograd/30 naspram izričitog Novi Sad/30, modelov stari Niš/20 naspram „okoline Beograda”, „po/u Srbiji”, samostalno „Srbija”, „po celom Balkanu”, samo onlajn rad uz zasebnu rečenicu o prebivalištu, ispravku broja bez pune jedinice, onlajn i terenski posao odvojene običnim zarezom i imena saradnica naspram radnog grada. Ispravka bez jasne jedinice sada traži dopunu, umesto upisa starog broja. Ciljani dokazi su izolovani helper i sintetički prolaz kroz stvarni Edge handler; ne predstavljaju živi provider ili bazu. Prepoznavanje slobodnog govora ostaje ograničeno (posebno drugačiji red reči, mala slova, padeži, više poteza razgovora i dvosmisleni mešani režimi) i ne sme se smatrati potpunom granicom autorizacije za široko područje. `LocationIQ place_id` je u sadašnjem adapteru izričito nepostojan provider hint; ne može sam da bude dugotrajni `placeId`. Nije izvršen živi Gemini/DEV/HONOR tok.

### Može li RS COUNTRY biti sledeća samostalna migracija?

**Da, ograničeno na izričito potvrđeno on-site „cela Srbija”**, ako `needs.task_country_code='RS'` ostane autoritativan rezultat potpisane lokacije zadatka. Država se tada proverava istim kodom `RS`, bez LocationIQ centra ili regionalnih granica. Ovo ne rešava Vojvodinu, Balkan, dva grada ili „grad i okolina”; samo po sebi ne uklanja obavezu administrativnog grada pri aktivaciji profila. Trenutni `location_market_configs` ima samo RS u statusu BUILDING, pa se ostale države ne smeju podrazumevati.

Ovaj uži paket mora **atomarno** obuhvatiti sledeće, pre nego što `COUNTRY` može biti aktivan:

1. Poseban ograničen `areas[]` kandidat/sačuvani zapis sa eksplicitnim `COUNTRY/RS` poreklom, vlasništvom, revizijom i readback-om; legacy `city/radius/approximatePosition` ostaje administrativni/compatibility podatak, a V2 receipt bira jedinu efektivnu on-site istinu. Ne izvoditi saglasnost za celu državu iz biografije, `operatingCountryCode` ili starog radijusa.
2. Worker AI provider schema, `parseWorkerOutput`, `private.worker_ai_initial`, `private.worker_ai_patch`, `private.worker_ai_document` i `worker_ai_source_hash` moraju nositi/ograničiti taj izbor. `rpc_read_worker_ai_context_service` i `rpc_read_worker_ai` moraju pokazati istu kandidatsku i sačuvanu verziju.
3. Oba aktivna pregledna RPC-a — `rpc_prepare_worker_ai_review_taxonomy` i `rpc_prepare_worker_ai_review_taxonomy_confirmed` — moraju potpisati prikazanu oblast zajedno sa uslugama, načinom izvršenja, `activate`, revizijom i digestom. `rpc_save_worker_ai_review` mora pod istim zaključavanjem i idempotentnim `clientRequestId` upisati baš prikazani izbor; Save i aktivacija ostaju odvojeni. Stari nepotpisani `rpc_prepare_worker_ai_review` treba ili uskladiti ili zatvoriti za V2.
4. `private.worker_need_fit_v1` mora za on-site koristiti isključivo potvrđeni V2 country zapis kada postoji, a u suprotnom postojeći V1 grad/centar. On-site RS zadatak prolazi područje samo po potpisanom `needs.task_country_code='RS'`; remote/handoff grana se ne menja. `worker_need_match_v1`, detaljni matcher, dispatch kandidat/push i `discovery_for_me_v1` moraju i dalje konzumirati isti fit. Ne dodavati drugi nezavisan filter za „Za mene”.
5. Promena oblasti mora idempotentno ponovo staviti otvorene zadatke u red preko postojećeg `requeue_open_needs_for_worker_v5` mehanizma. Jedan task/worker/revizija ostaje jedna `opportunity_delivery`/push prilika; proveriti novu aktivaciju, prelaz country↔legacy, paralelni Save, izgubljen receipt, RLS, izvoz i brisanje naloga.
6. Native review, sačuvani profil i AI korekcija moraju prikazati efektivno područje kao „Cela Srbija” samo iz potvrđenog readback-a, bez prikazivanja starog radijusa kao druge aktivne istine. Proći lokalnu SQL/Auth proveru i stvarne DEV dvonaložne `Za mene`/push scenarije pre tvrdnje o runtime-u.
