# Izvršenje prihvaćenog plana — paket od 18.10.2026.

Ovo je dokaz konkretnog paketa uz postojeći registar 62 toka, ne novi master plan. Polazni commit `51c82418`, checkout `USKOCI-EAN`, grana `feature/unified-qa-master-20261017`. Ceo plan nije završen ovim paketom.

## Implementirano u izvoru

1. **Isporuka.** Jedan build contract proverava kanonski DEV i tri signed-review zastavice. Preview APK i OTA koriste isti ugovor. Production build i production OTA odbijaju rad dok zasebna proizvodna konfiguracija i spremnost nisu potvrđene. DEV URL/ključ uklonjeni iz production env. Početna lokalna izmena tri preview zastavice u eas.json sačuvana je i uključena u ovaj ugovor.
2. **Razvojne rute.** Svih 21 `src/app/dizajn-*` scena premešteno je u `src/designLab/`; sačuvani su testovi i manifest porekla. Nema aktivnog uvoza tih scena iz proizvoda. Njihovi istorijski deep linkovi više nisu korisničke rute; trenutno se scene montiraju testovima. Zaseban native lab host nije dodat.
3. **Istorijski HTML.** Postinstall sada uzima tri sačuvana resursa iz `assets/brand/reference-entry/`, proverava hash i kopira ih na postojeće generisane putanje. Istorijski HTML nije build ulaz. Ni resursi ni istorijski dokument nisu izgubljeni. Test u praznom privremenom projektu bez docs foldera prolazi; izmenjeni hash ili nedozvoljena putanja zaustavljaju upis pre prvog fajla.
4. **Početna.** Radar je povezan na karticu „Uskoči i zaradi“. Rotacija je nativna i ne drži interaction handle; staje bez fokusa, van vidljive kartice, u pozadini i uz Reduce Motion. Prazan odeljak „Čeka te“ izostaje; nedostupni podaci i stvarne sledeće radnje ostaju vidljivi. Jedinstven nalog i četiri glavna odredišta su očuvani.
5. **Profil/razgovor.** Prazna oprema se ne prikazuje kao zahtev za popunjavanje. Sačuvani alat ili vozilo ostaju dostupni. Povratni uvod u AI razgovor, kada profil već ima sadržaj, kompaktniji je i počinje pri vrhu; nova poseta zadržava svoj uvod.
6. **AI instrukcije i primena.** Oba intervjua imaju instrukcije za najviše tri kratka povezana pitanja i očuvanje delimičnih odgovora. Worker paket uključuje isti dozvoljeni skup klasifikacionih akcija kao requester. Ovo nije nova šema odgovora, katalog, binding, model ili potvrda da je ponašanje već provereno sa Gemini-jem.
7. **Native kandidat.** Postojeći `build-latest-v5-preview-apk.yml` sada bira phone/ARM64 ili emulator/x86_64. Podrazumevani phone cilj ostaje isti. Provereni su YAML i stvarni skript izbora za oba cilja i odbijanje nepoznatog cilja. Workflow zadržava puni Jest, TypeScript, tačan NDK checksum i proveru sastavljenog APK-a; ne objavljuje OTA ili prodavnicu. Stari `build-android-dev-apk.yml` i dalje namerno zahteva svoju istorijsku baseline granu; nije korišćen za novi feature kandidat.

## Provere i granice

- Build guard: reprodukovan FAIL pre povezivanja stvarnog app.config guard-a; PASS posle. Node build/asset/boundary/OTA provere 25/25.
- Taksonomija: 141/141 offline Node provera PASS. To nisu plaćeni AI pozivi niti DEV SQL izvršavanje.
- Ciljane provere Home/chat/profile/build: 244/244; Firebase fixture 13/13; recovery/galerija 97/97; matching consumer map 50/50. Brojevi se preklapaju sa punim Jest skupom i ne sabiraju se kao ukupan broj jedinstvenih testova.
- TypeScript: PASS. Završni puni Jest: 620/620 paketa PASS; 13.820 PASS / 9 SKIP / 0 FAIL od 13.829 testova; 6/6 snapshot-a PASS; exit 0, 1.016,55 s. Pokrenut sa `--runInBand --silent --detectOpenHandles`; proces se završio bez prinudnog prekida. Hash izlaza je u `TEST_RESULT_20261018.json`. Prvi puni prolaz: 620 paketa, 616 PASS / 4 FAIL; 13.809 PASS / 11 FAIL / 9 SKIP od 13.829 testova, 6 snapshot-a PASS. Otkrio je izostavljen build-contract u izolovanom Firebase fixture-u, stare Home tekstove, ranije promenjen tekst obaveštenja i tri country-guard SQL čitaoca koja nisu bila u istorijskom consumer-map popisu. Ciljane ispravke ne uklanjaju poslovne provere. Prvi izlaz sačuvan je lokalno kao `jest-full.log`; završni kao `jest-final.log`.
- Android export: uspešan; source map ima 5.834 modula, nijedan iz designLab ili app/dizajn-*; Home jeste uključen. Ovo dokazuje JS bundle, ne potpisan APK niti instalaciju.
- Emulator: `rs.uskoci.preview`, x86_64, versionCode 35; postojeći APK SHA256 `aa305ccd80b368c8e5e0262847c3707593162728d4d9e91481933a742df38350`, sa tekućim razvojnim Metro kodom. Početna prikazuje radar i snimci pokazuju promenjen ugao. „Uskoči i zaradi“ otvara Zadaci. Ne tvrditi da je to novo izdanje APK-a.
- Tokom Fast Refresh-a zatečen je worker ekran „Radni profil nije dostupan“. Ponovni miran prolaz kroz Profil → Radni profil → Uredi kroz razgovor uspešno učitava profil i kompaktniji uvod. Nije potvrđen uzrok ranijeg prolaznog stanja. Nije poslata poruka, menjan profil ili čuvan review. Automatski UI dump nije uvek uspevao dok se ekran kretao/osvežavao; to nije dokaz ANR-a. Novi APK je kasnije proveren u ograničenom obuhvatu ispod; ceo save/reopen tok i dalje nema dokaz.

## DEV i sledeća granica

Read-only preflight pre primene: requester v89 i worker v44. Paket sa hash-ovima je `docs/implementation/v5-ai-first/INTERVIEW_RELEASE_CANDIDATE_20261018.json`; status je APPLIED_DEV_EXACT_READBACK. Prethodni kompletni paketi sačuvani su u lokalnom radnom dokazu za tačan rollback. Vlasnik je odobrio konkretan paket: „Primeni ovaj Edge paket na DEV“. Primenjeni su requester v90 (9/9 fajlova) i worker v45 (6/6 fajlova), uz identičan readback i očuvan verify_jwt=false iz prethodnog deployment-a. Receipt: `supabase/operations/dev-alpha/ledger/20261018100710_interview_grouped_questions.receipt.json`. Plaćeni Gemini razgovor nije pokrenut. Baza, sertifikat, push i stvarni poslovni podaci nisu menjani.

Nastavlja se postojeći plan: potvrđeni worker model kroz save/read/binding i područja po usluzi, regionalna kandidatska pretraga, stvarni gostujući AI sa ograničenim pravima, closure obuhvat, potpuni task/profile edit tokovi, mape i poruke, završno vizuelno usklađivanje i novi APK sa vezanim dokazima. Ti delovi nisu zamenjeni kozmetičkim prikazom niti proglašeni završenim.

## Očuvano van ovog paketa

`supabase/candidates/register_3d_print_taxonomy.sql` je zatečen tuđi/nepridružen kandidat: nije menjan, primenjen niti uključen u ovaj paket. Stari dokazi ostaju datirana istorija. Generisanje control HTML-a nije objavljivanje hosted table.

## Izvor i native isporuka

Izvorni paket je commit `07c9d9e2eaaab30c40774ea7cae2554996dee2e6`; CI cilj ispravljen je u `b92b55d09e257270016a780e6fc8c057f6a06015`. Novi emulator workflow run `39118632476` je SUCCESS. CI: 620/620 paketa, 13.829/13.829 testova i 6/6 snapshot-a PASS; TypeScript PASS; native build i attestor PASS. Prvi run `39118586835` je otkazan pre native build-a jer je izbor ABI morao da važi i za završni APK attestor.

### Proveren novi APK

`NATIVE_RESULT_20261018.json` povezuje CI receipt, source, flags, tačan APK hash, ugrađeni update, Edge receipt i hash-eve privatnih lokalnih snimaka. `adb install -r` je sačuvao nalog. Početna → Zadaci i Profil → Radni profil → Uredi kroz razgovor prošli su kao čitanje/navigacija, bez plaćenog AI slanja ili Save. Ekran O aplikaciji potvrđuje source b92b55d0 i ugrađeni update 2eaa68be, preview runtime/kanal. Nema fizičkog phone dokaza.

Ograničenja: sourceDirty=true je sačuvan u dokazu. CI log beleži Expo prebuild izmenu package.json; CLI menja android/ios scripts. Tačan diff posle prebuild-a nije uploadovan, pa se ne tvrdi potpuno čist build checkout. Home UI dump nije uspeo tokom neprekidne animacije, iako slika i navigacija rade. Pri fokusu praznog inputa emulator je pokazao plivajući IME, pa običan donji keyboard layout nije prihvaćen. Plaćeni test ima samo pripremljen predlog u `AI_NATIVE_ACCEPTANCE_20261018.md`, bez novog odobrenja ili izvršavanja.
