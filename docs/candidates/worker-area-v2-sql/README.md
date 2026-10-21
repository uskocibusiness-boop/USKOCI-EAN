# Area V2 / COUNTRY–RS i više mesta: provereni SQL podsklopovi, bez aktivacije

**Status 21.10.2026:** izvorni kandidat, ne migracija. Nije primenjen na DEV niti povezan s aktivnim worker AI, Save, matcherom ili APK-om. Služi da se ograniči i proveri sledeća serverska izmena. Ne koristiti kao dokaz da „cela Srbija” sada daje zadatke.

## Šta je napravljeno

- [00_country_rs_core.sql](00_country_rs_core.sql) definiše strogo jednu oblast `COUNTRY/RS/ON_SITE`, privatnu shadow tabelu sa RLS i bez direktnih grantova, guard vlasništva profila, owner-scoped read i čistu proveru oblika budućeg kandidata. Provera oblika sama ne dokazuje potpisan pregled. Matcher helper vraća `NULL` za V1 profil ili remote zadatak; sa V2 redom prihvata samo `STATIONARY + task_country_code=RS`, a nepoznatu državu i rute odbija.
- [10_rollback_proof.sql](10_rollback_proof.sql) proverava ACL, dva različita naloga, strano čitanje/upis, V1 fallback, RS on-site, remote, nepoznatu državu, sve ostale geografske režime i negativne oblike AI kandidata.
- [20_multi_locality_core.sql](20_multi_locality_core.sql) dodaje zaseban **shadow** podsklop za 1–5 mesta sa potvrđenim identitetom mesta i zasebnim radijusom. Mesta se u stvarnom toku moraju serverom razrešiti iz korisnikovih reči; ovde nema unetih stvarnih mesta. Katalog je privatan i nepromenljiv po verziji. Kandidat vraća nazive iz kataloga, a vlasnički pregled ne otkriva koordinate. Za on-site `STATIONARY` zadatak koristi se samo javna gruba tačka zadatka; `REMOTE` ostaje izvan područnog filtera, a rute/nepoznata zemlja/tačka se odbijaju.
- [30_multi_locality_rollback_proof.sql](30_multi_locality_rollback_proof.sql) proverava dva privremena test mesta, dva izabrana mesta, vlasništvo, podudaranje, konflikt s COUNTRY redom, nedozvoljenu izmenu kataloga i odbijanje neproverenog regiona, sirovog naziva grada, duplikata i radijusa bez potvrde.
- Ceo podsklop i proba izvršeni su u **jednoj transakciji sa ROLLBACK** na DEV `leqcwgzvjsxugfgzdmth`. Rezultat: `AREA_V2_ROLLBACK_PROOF_PASS`, jedan *privremeni* red. Odmah zatim read-only `to_regclass/to_regprocedure` potvrdili su da tabela i obe proverene funkcije ne postoje na DEV-u. Ovo je SQL proba oblika/izolacije, ne probni Save ili stvarni matching.
- Drugi podsklop je zasebno izvršen zajedno sa `00_country_rs_core.sql` u **jednoj transakciji sa ROLLBACK** na istom DEV-u. Rezultat: `AREA_V2_MULTI_LOCALITY_ROLLBACK_PROOF_PASS`, dva *privremena* kataloška mesta i dve *privremene* oblasti. Posle vraćanja, read-only provera potvrdila je odsustvo sve tri nove tabele, vlasničkog RPC-a i matcher helpera. Prvi rollback dokaz ostaje zaseban i važeći; nijedan podsklop nije aktivan.

Primer ponavljanja preko jednog SQL poziva:

```sql
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='3s';
-- sadržaj 00_country_rs_core.sql
-- sadržaj 10_rollback_proof.sql
ROLLBACK;
```

Ne pokretati `00_country_rs_core.sql` samostalno; namerno nema `COMMIT` ni upisni RPC. Postojeći `private.worker_need_fit_v1` nije zamenjen. `source_review_id` i digest u shadow redu su rezervisana mesta za budući atomarni Save; ovaj podsklop **još ne dokazuje** da red potiče iz stvarno potpisanog pregleda.

Za drugi dokaz u isti `BEGIN … ROLLBACK` redom uključiti `00_country_rs_core.sql`, `20_multi_locality_core.sql` i `30_multi_locality_rollback_proof.sql`. Lokalni SQL helperi nikada ne upisuju aktivnu oblast radnika. Sintetički katalog u proveri nije katalog Novog Sada ili Beograda.

## Šta korisnikova prirodna izjava znači u ovom ugovoru

| Izjava | Bezbedno značenje pre Save-a | Trenutni rezultat |
| --- | --- | --- |
| „Cela Srbija” | Izričito potvrđen `COUNTRY/RS/ON_SITE`; radnik ne mora dati mesto stanovanja, GPS ni pin. | Proveren samo shadow oblik i STATIONARY RS filter; nema signed Save ni stvarnog matchinga. |
| „Novi Sad i Beograd” | Server razreši **dva** stabilna ID-a mesta, pokaže oba naziva i obim za svako, pa potpiše izbor. Ako obim nije poznat, pitati; ne izmisliti radijus. | Dokazano je da SQL može proveriti 2 različita razrešena ID-a i radijusa i spojiti ih pri matching-u. Nisu razrešeni stvarni gradovi niti izmenjen aktivni matcher. |
| „Novi Sad i okolina” | Jedno mesto + jasan radijus u km koji korisnik potvrdi. „Okolina” sama nema bezbednu kilometražu. | Kandidat odbija izostavljen radijus; AI/server treba kratko pojašnjenje, bez obaveznog kućnog pina. |
| „Vojvodina” | Verzionisan ID administrativnog regiona, verifikovana granica i zadatak s pouzdanom regionalnom pripadnošću. | `ADMIN_REGION` je namerno odbijen. Postojeći zadatak nema region ID, a ovde nema verifikovane geometrije; nema tvrdnje da region radi. |
| „Balkan” | Zahteva definiciju zemalja, tržišne i pravne uslove. | Nije u MVP SQL kandidatu. |

Sadašnjih 9 RS `STATIONARY` DEV zadataka imaju 8 grubih tačaka i jedan bez nje. Za više mesta, ovaj helper bez grube tačke vraća `false`, čak i kada tekst grada liči na izabrano mesto. To je svesni privremeni gubitak pokrivenosti, a ne uspešno prepoznavanje mesta. Gruba tačka nije privatna tačna adresa; za zadatke na granici radijusa potrebna je posebna product odluka o toleranciji, bez prikazivanja privatne adrese.

## Dokazana zavisnost od postojećeg ugovora

| Korak | Trenutni izvor / dokaz | Uslov za aktivni COUNTRY/RS |
| --- | --- | --- |
| AI kandidat | `20260912220506_clean_v5_owned_worker_profile.sql`: `worker_ai_initial`, `worker_ai_patch`, `worker_ai_document`; `uskoci-worker-interview/index.ts` i `workerAiClientService.ts` | Edge/provider schema i parser, oba DB patch puta, dokument i strogi native decoder moraju nositi `areas[]`. Široka tvrdnja iz bio/prebivališta/remote klauze nije izričita on-site saglasnost. |
| Potpisani pregled | `20261019104604_service_handoff_signed_matching.sql`: `rpc_prepare_worker_ai_review_taxonomy` i `..._confirmed`; oba uključuju ceo `profile` u digest | Oba puta moraju prikazati i potpisati `areas[]`, servisne režime i aktivaciju; stari `rpc_prepare_worker_ai_review` ne sme omogućiti zaobilazak. Bez nove revizije/digesta ne prihvatati star review. |
| Save / aktivacija | `20260912220506_clean_v5_owned_worker_profile.sql`: `rpc_save_worker_ai_review`, `rpc_complete_worker_profile`; DEV `private.location_text_valid('')=false` | Pod istim zaključavanjem Save mora proveriti review, profil, `source_hash`, reviziju, digest i idempotentni request ID, upisati V2 oblast i vratiti readback. Novi profil s jedino „cela Srbija” nema obavezan grad: izmeniti **obe** city provere pri pripremi i aktivaciji, i ne forsirati legacy location writer sa praznim gradom. Save i aktivacija ostaju različite radnje. |
| Jedan izvor matching istine | DEV `worker_need_fit_v1` MD5 `a15a603d98d7d594fd451959526aba8f`; `worker_need_match_v1`, `match_detail_without_calendar`, `dispatch_cheap_candidate_admitted`, `discovery_for_me_v1` ga koriste | Samo `worker_need_fit_v1` treba da bira potvrđeni V2 country red ili V1 grad/radijus. Za country rezultat `distanceKm/effectiveRadiusKm` moraju biti `null`, a remote/handoff ostati neizmenjen. Rute čekaju proveru svih tačaka/država i zasad su fail-closed. |
| Promena i push | DEV `requeue_open_needs_for_worker_v5` MD5 `371bb38ea1d7180ca6222409f1a9a591`; `dispatch_next_wave` koristi idempotentni delivery po potrebi/reviziji | Nakon potvrđenog prelaza V1↔V2 ponovo staviti otvorene zadatke u red. Testirati da jedna task/worker/revizija ne pravi duplu priliku/push. |
| Izvoz i zatvaranje naloga | `20260913001000_clean_v5_owned_export_projection.sql` ograničava polja worker kandidata i ima projection SHA/policy binding; `20260913081147_clean_v5_event_bound_account_erasure.sql` ima zatvorenu listu redakcijskih relacija | Dodati `areas[]` u izvoz nacrta/pregleda i sačuvanu oblast u profilni skup uz novu policy/pravnu vezu. Shadow tabelu dodati u closure redosled/scope/DELETE i izvorni digest. `ON DELETE CASCADE` nije dovoljno: sadašnji account closure rediguje sačuvani profil, ne briše ga automatski. |

Read-only DEV provera pre SQL probe: 10 radnih profila, od toga 4 aktivna; 9 STATIONARY RS zadataka, jedan STATIONARY bez države i 10 REMOTE. To su testni podaci trenutka, ne dokaz prihvatljivog korisničkog toka.

## Blokade za migraciju

1. Nema atomarnog upisa iz `rpc_save_worker_ai_review`, pravog signed receipt-a i dokaza za izgubljen odgovor/paralelni Save. Shadow red može da upiše samo privilegovan SQL test.
2. Nema kandidatskog `areas[]` kroz Gemini, server patch, oba review RPC-a i native dekoder, niti server-odobrenog kataloga mesta. Trenutni AI V1 guard je heuristički; izrazi malim slovima `radim u novom sadu i beogradu`, `novi sad i beograd`, `radim u nišu i kragujevcu` bili su reprodukovani kao `NONE`. Shadow MULTI_LOCALITY SQL ne popravlja to prepoznavanje; on prima samo prethodno razrešene ID-eve i potvrđene radijuse.
3. Nema pravilne promene/ukidanja V2 oblasti. Trenutni kandidat odbija `areas: []` da se posle „cele Srbije” ne vrati prećutno na stari radijus. Potrebna je zasebno potpisana promena nazad na lokalitet ili bez on-site područja.
4. Export/closure hash-bound ugovori nisu prošireni. Ne praviti forward migraciju niti puštati podatke u ovu tabelu dok se redakcija, izvoz i pravni binding ne validiraju.
5. Nema runtime dvonaložne provere `Za mene`, prijave, dispatch/push i mrežnog oporavka, ni HONOR prohoda. Nema regiona ili place ID servisa; `LocationIQ place_id` je nepostojan hint u postojećem adapteru.
6. Jedinstven efektivan izvor područja nije uveden: dva shadow reda su moguća u probnoj šemi. MULTI_LOCALITY matcher tada odbija on-site rezultat i vlasničko čitanje kaže `CONFLICT_BLOCKED`, ali zasebni COUNTRY helper sam za sebe to ne proverava. Budući Save mora u istoj transakciji ukinuti stari izvor i upisati novi, pa jedno objedinjeno matcher/read čitanje mora dokazati tačno jedan izvor.
7. REGION/„Vojvodina” zahteva verifikovanu, verzionisanu granicu ili kanonski region ID na zadatku; tekst `approximate_area` nije autoritet. Potrebna je odluka o zadacima uz granicu i o slučajevima kada zadatak nema grubu tačku. Bez toga region ostaje odbijen.

## Sledeći proverljiv paket

Prvo izraditi proverljiv server resolver i verzionisan katalog stvarnih mesta, uz test da „Novi Sad i Beograd” u svim uobičajenim oblicima daje dva potvrđena ID-a, a „Novi Sad i okolina” traži kilometražu. Zatim kompletan potpisani COUNTRY/RS i MULTI_LOCALITY tok u novoj **forward** migraciji tek uz sve gore navedene zavisnosti, pa Edge/native dekodere. Pokriti: novi radnik bez grada, postojeći V1 radnik, aktivan→COUNTRY→dva mesta→lokalitet, remote-only, dvosmislen AI odgovor, konflikt revizije, dupli request ID, drugi nalog, zatvaranje/izvoz, RS on-site vs nepoznata država, rute, jedan delivery i requeue. Region je zasebna celina nakon dokaza geometrije/task identiteta. Posle lokalnih/rollback proba, proveriti DEV readback i dva naloga pre bilo kakve tvrdnje o gotovom Area V2.
