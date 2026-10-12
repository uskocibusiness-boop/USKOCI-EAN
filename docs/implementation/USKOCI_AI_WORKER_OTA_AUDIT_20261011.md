# USKOČI — AI, radnički profil, backend i OTA: read-only release audit
**Presek: 11. oktobar 2026.**  **Status: PREVIEW CANDIDATE / NO PUBLIC RELEASE.**
**Izvori:** aktuelni GitHub `work/uskoci-ui-unification-20260924`, Draft PR #6 `fix/match-ai-category-fallback-20261010`, stvarne postavljene Supabase Edge funkcije i agregati DEV `leqcwgzvjsxugfgzdmth`, `app.config.js`, `eas.json`, izvorni P00 phone OTA zapis, GitHub Actions.
**Granica:** Sve Supabase provere bile su READ-ONLY. Nisu pozivani plaćeni AI provider, korisnički RPC write, push, OTA objava, migracija, EAS build, merge ili prod podaci. Ne tvrditi da su svi ekrani i E2E fizički provereni.

## 1 — Pravilo proizvoda koje je vlasnik potvrdio
* **Vrsta posla je primarni kriterijum** za izbor radnika. Radnik potvrđuje usluge koje obavlja, a naručilac opisuje radnju, predmet posla i obim prirodnim govorom; AI već priprema `NEED_FACT_V2`.
* LOKACIJA, DATUM/TERMIN i BROJ LJUDI čine primarne dodatne uslove; područje, raspoloživost, kapacitet i sigurnosne zabrane ostaju obavezni.
* `required_skills` je **samo izričit dodatni zahtev**, a ne obavezno nabrajanje alata. Potvrđeni tip posla mora odgovarati čak i kada je ovaj niz prazan. Ako postoji dodatni zahtev koji menja izvršivost (npr. gletovanje uz krečenje), mora se posebno proveriti i ne sme prepisati osnovnu uslugu.
* `required_tools` i `required_vehicles` su opciona svojstva: za standardnog molera nema pitanja „imaš li šrafciger”; za prevoz kabastog tereta proveriti nosivost, dimenzije, broj komada i pristup gde su relevantni. Ne smatrati odsustvo podataka automatskom potvrdom kapaciteta.
* Radnički profil kao prvi korak pita „Koje poslove radiš?”, zatim područje i dostupnost. Oprema, prevoz, portfolio i iskustvo nisu obavezne liste za svaku uslugu.
* Četiri glavne kartice su **Početna, Zadaci, Dogovori, Poruke**; plus za objavu, avatar i zvonce gore.
* Kasniji UX: posle odsustva jedan dodir za sve **nove i relevantne** zadatke od poslednje posete; prvo dokazati postojeći `Za mene` reader, watermark i privacy pre dodavanja drugog feed-a.

## 2 — Stvarno postavljene Edge funkcije i neusaglašenost sa repoom
| Funkcija | DEV verzija | Izvorna usklađenost | Zaključak |
|---|---:|---|---|
| `uskoci-ai-interview` | 60 | **drugačija** od glavne grane i Draft PR-a | Repozitorijumska 3 prompt/price izmena + dodatni savet za servisnu kategoriju u PR-u nisu aktivni |
| `uskoci-worker-interview` | 23 | **drugačija** od glavne grane | Repo ima bolje postupanje sa nerazumljivim transkriptom i AI credit diagnostics; tek testirati deploy |
| `uskoci-push-transport` | 28 | isto kao glavna grana, **različito od PR-a** | PR ima izolovan `OPPORTUNITY_AVAILABLE` exact-event payload iza dodatnog feature gate-a; nije live |
| `uskoci-publication-evaluate` | 19 | jednako | Postavljena verzija se poklapa sa kodom |
| `uskoci-qa-classify` | 18 | jednako | Poklapa se |
| `uskoci-location-search` | 19 | jednako | Poklapa se |
| `uskoci-speech-session` | 20 | jednako | Poklapa se |
| `uskoci-data-export-worker` | 19 | jednako | Poklapa se |
| `uskoci-data-export-download` | 19 | jednako | Poklapa se |
| `uskoci-media` | 19 | jednako | Poklapa se |
| `uskoci-account-closure-worker` | 9 | jednako | Poklapa se |

Usklađenost znači *identičan izvorni `index.ts`*, NE tvrdnju da je svaki dependency, env, provider, SQL funkcija i ponašanje isti. Nije izvršeno ažuriranje servera.

### AI za zadatke
DEV čuva 523 AI turn komande: 469 `SUCCEEDED` i 54 `FAILED` kroz istoriju. Poslednjih sedam dana: 147 uspešnih i 6 neuspešnih. Postoje 214 razgovora i 1104 poruke (agregati). Ovo dokazuje stvarnu obradu, **ne** semantičku tačnost Gemini rezultata. `GEMINI_MODEL`, `AI_PROVIDER`, `USKOCI_GEMINI_PAID_TEST_ENABLED` i kontrola budžeta su runtime kapije, ne sme se iz statusa Edge=ACTIVE pretpostaviti da je svaki sledeći poziv dostupan. Bez trošenja tokena ili čitanja privatnih poruka ne tvrdimo trenutni provider E2E PASS.

### Radnički profil
DEV istorija: 65 radničkih AI turn-ova (61 `SUCCEEDED`, 4 `FAILED`), 10 review zapisa, 5 save zapisa; 2 ACTIVE radnička profila sa popunjenim uslugama i 3 DRAFT radnička profila. AI intervju je odvojen od pregleda i eksplicitnog čuvanja/aktivacije. Kod obezbeđuje unos usluga, područja, dostupnosti i opcionih alata/vozila. I dalje treba proveriti najnoviji realni telefon: srpski slobodan opis → AI predlog → pregled → save → aktivacija → matcher.

## 3 — Matching i dispatch: kritični prekid veze
* Na DEV-u je `private.worker_need_fit_v1` još MD5 `ab221f0091d78856bb42f702ddecd016`. Njegov `service` uslov trenutno sadrži logiku po kojoj prazan `required_skills` može dati `service=true` bez potvrde `need.category`. To ne odgovara vlasnikovom načelu: **vrsta posla je glavna**.
* 7 DEV zadataka ima kategoriju, svih 7 nema eksplicitne dodatne skills; to nije greška autora već razlog da category matching bude primaran. 2 DEV zapisa su `PUBLISHED`, ali u ovom preseku nijedan nema otvoren `response_deadline`.
* Postoje `needs_enqueue_dispatch`, `private.dispatch_tick`, `private.dispatch_next_wave`, 2 aktivna minutna cron-a. 65 istorijskih dispatch rounds je `STOPPED` sa `NO_ELIGIBLE_CANDIDATES`; bez dokaza o svakoj grupi ne označavati sve kao softverski bug ili svi kao nedostatak radnika.
* 2 `notification_deliveries` sa PUSH:SENT i 2 push pokušaja i 2 registrovana uređaja; nema sačuvanih prijava ni Dogovora u trenutnom DEV preseku. `SENT` je transportni zapis, nije dokaz da je obični preview APK prikazao obaveštenje i otvorio tačan zadatak.
* PR #6 sadrži **izolovano PASS** kandidata category fallback / dynamic taxonomy, ali **nije aktiviran**: 0 novih `private.work_taxonomy_*` tabela i stari matcher hash je nepromenjen.
* **Ispravljeno u Draft PR-u, ali NIJE na DEV-u:** SQL kandidat sada zahteva **osnovnu vrstu usluge AND svaku izričito neophodnu dodatnu veštinu**, umesto da dodatna veština zameni kategoriju. Novi kandidat `pg_proc.prosrc` MD5: `d511b48f7f3b38f52aaffee420108f8a`; stari živi DEV ostaje `ab221f0091d78856bb42f702ddecd016`. Rollback, source hash guard i odvojeni disposable negativni/pozitivni test su ažurirani. CI `38146841092` SUCCESS; ovo nije deploy ili provider/phone proof.

## 4 — OTA: šta jeste, a šta nije moguće
* Stvaran P00 dokaz, 7. oktobar: owner preview APK `rs.uskoci.preview`, kanal `preview`, runtime `uskoci-v1-preview-r1` preuzeo OTA na telefonu, zatim i JS lokacijsku ispravku bez reinstalacije. Dokaz u `docs/implementation/product-v1-closure-20260926/finalization-20260927/ota/P00_OTA_PHONE_PROOF_20261007.md`.
* Tekstovi, boje, navigacija, ekran AI razgovora, worker-profile editor, JS filteri i JS bugfix mogu kroz OTA ako su **native kompatibilni** i odgovaraju kanalu/runtime.
* **Konkretan kompatibilnosni nalaz:** Oct 7 preview phone proof APK iz commit-a `131d9f84` nije isto što i poslednji GitHub HEAD: GitHub compare je 399 commit-a unapred i ograničen na prvih 300 izmenjenih fajlova; među njima je `app.config.js`. Direktno čitanje oba fajla potvrdilo je novi native Android `blockedPermissions` unos za `android.permission.SYSTEM_ALERT_WINDOW`. Stoga trenutno važeći `scripts/ota-preview-guard.cjs` pravilno blokira direktan OTA najnovijeg izvora prema 7.10 baseline-u. Nije potvrđeno da je upravo taj APK danas instaliran; pre objave treba identifikovati aktuelni compiled build i njegov exact SHA. Istovetan string `runtimeVersion` nije dokaz binarne kompatibilnosti. Izmene servera idu zasebno i NE čekaju APK, ali SQL/Edge migracije ne nastaju same od OTA.
* Novi native modul, Android dozvola, paket, Firebase enrolment ili promena JS-native API ugovora zahtevaju novi APK/AAB i kompatibilan runtime. `app.config.js` namenski ostavlja obične preview build-ove bez Firebase enrollment-a; zaseban push-proof build može da ga uključi. OTA ne menja baked native konfiguraciju.
* EAS `preview` i `production` su odvojeni; produkcija ima `uskoci-v1-production-r1` i paket `rs.uskoci`.
* **STORE RELEASE BLOCKER:** `eas.json` `production` i dalje pokazuje **kanonski DEV** Supabase endpoint. Ne koristiti to kao javnu produkciju i ne usmeravati novo tržište na razvojnu bazu.
* **Kritična Expo zamka:** vrednosti `env` iz `eas.json` build profila nisu automatski dostupne pri `eas update`; ako `EXPO_PUBLIC_CONVERSATION_INBOX` / `EXPO_PUBLIC_P6_DISCOVERY_READER` izostanu iz OTA bundle okruženja, JS može sakriti tab Poruke i P6 čitač. Kod već izričito ima ove oznake `'1'` u oba build profila.
* Dodati `scripts/ota-release-preflight.cjs`, test i `.github/workflows/ota-bundle-safety-proof.yml` u Draft PR-u: rade **offline** proveru profila/flagova, odbijaju produkciju usmerenu na DEV i zahtevaju poznat 40-znakovni SHA izvornog native build-a plus identičan OTA bundler env u pravom preflight režimu. `--plan-only` daje isključivo proveru izvora. **To još nije automatska prepreka svakom ručno pokrenutom EAS update-u**; release procedura ga mora pozvati pre eventualnog odobrenog objavljivanja.
* Ne postoji sadašnji EAS cloud/telefon dokaz za poslednji HEAD PR-a, niti je bilo OTA objave u ovom auditu.

## 5 — Šta sledeće testirati i završiti, redom
1. **P0 Category matching:** prirodni AI naziv usluge → kanonska vrsta posla / stabilni UUID → worker-confirmed capability, bez obavezne liste alata. Dokazati negativne slučajeve (čistač nije moler; vozilo bez nosivosti nije potvrda prevoza; gletovanje bez krečenja nije potpuno preuzimanje zadatka). Dopuniti i testirati draft pre primene.
2. **P0 Worker profile:** ceo postojeći v23 intervju, sačuvani pregled i aktivacija, prirodan srpski, po jedna smislena dopuna. Posebno QA za završetak „to je to“, oprečan odgovor, nejasan glas i ponovno otvaranje; bez duplog snimanja i nedozvoljenog automatskog proširenja veština.
3. **P0 Publish→dispatch→recipient:** izolovani PostgreSQL test sa 3 worker tipa, istom lokacijom/različitim vremenom, bez push-a. Zatim tek po odobrenju disposable DEV E2E u autentifikovanom svetu i potvrda da korisnik vidi razlog nula kandidata.
4. **P0 Push phone:** proveriti tačan instalirani Android paket/runtime i FCM/native enrollment, omogućiti namenski test APK kada je potreban, potom dokazati event → ciljanu push isporuku → tap → tačan task/poruka. Ne uključivati globalne push prekidače kao prečicu.
5. **P1 OTA preview:** izvorni `--plan-only` + sam preflight naspram SHA stvarno instaliranog APK-a + provereni env + validiran kanal → owner-approved canary OTA → fizički restart/update/rollback proveru. Bez novih native biblioteka na starom runtime-u.
6. **P1 Poslovni krug:** objava, prijava, izbor, Dogovor, tekst/glas/foto, završetak, ocene, otkazivanje, ponovno traženje ljudi. Testirati aktuelnu reviziju, ne oslanjati se na septembarske potvrde.
7. **P1 Play Store/Apple:** produkciona baza i domen, zakoniti javni dokumenti/data-safety, reviewer account, store build, potpis, dozvole, crash telemetry i Play closed-test uslovi. Nijedan izolovan CI PASS ne zamenjuje te kapije.
8. **P2 UX nakon povratka:** jedan klik „Novo za mene“, server watermark poslednje potvrđene posete, pregled svih stvarno novih/povezanih zadataka, bez sakrivanja drugih u „Svi zadaci“, nema duplih notifikacija.

## 6 — Izvorni dokazi, bez deploya
- Izolovani PostgreSQL 16/17 category bridge: GitHub Actions `38138404028` — SUCCESS.
- Postojeći source-only testovi PR #6: PRE-P4, AI category matching, push event source, auto taxonomy svi SUCCESS na prethodnom HEAD `03ccadb8`.
- OTA bundle source-only/negative test: GitHub Actions `38145450384` i `38145446845` — SUCCESS na `59a914c10`.
- Ovaj dokument i `ota-release-preflight.cjs` su samo commit-i u Draft PR #6. **Nema live promene, merge-a, OTA publikacije ili plaćenog AI provider poziva.**
