# 17 — Mobile Performance, OTA vs. Native Build & Google Play Store Readiness

## 1. Pravilo razdvajanja: OTA Update (`eas update`) vs. Novi Native Build (`.apk` / `.aab`)

U `app.config.ts` / `app.json` podešen je `runtimeVersion: { policy: "appVersion" }` (trenutno `1.0.0`, `versionCode: 1`).

| Vrsta izmene | Kako se isporučuje | Zašto |
|---|---|---|
| **Izmene u TypeScript/JavaScript kodu (`src/**`), UI komponentama, ekranima, stilovima, RPC klijentima** | **OTA Update (`eas update`)** ili novi JS bundle | Ne menja nijednu native Android biblioteku niti `AndroidManifest.xml`. |
| **Izmene u `supabase/functions/**` ili `supabase/migrations/**`** | **`supabase functions deploy` / `supabase db push`** | Izvršava se direktno na Supabase serveru; klijentska aplikacija odmah koristi novu logiku (npr. **Dual-Gemini** je već uživo na serveru!). |
| **Dodavanje/uklanjanje native paketa u `package.json`, promena dozvola u `app.config.ts`, promena ikone/splash ekrana ili `runtimeVersion`** | **Novi Native Build (`.apk` za telefon / `.aab` za Play Store)** | Menja binarni Android omotač (`android/`). |

---

## 2. Performanse na Android uređajima

1. **Uklanjanje `BlurView` iz `SearchBackdrop.tsx`:** Zamenom `<BlurView blurMethod="dimezisBlurViewSdk31Plus" />` čistim Reanimated poluprovidnim slojem uklanja se nepotrebno GPU renderovanje pri otvaranju pretrage i filtera.
2. **Eliminacija `SHEET_KICKS_MS` tajmera u `DiscoveryPresentation.tsx`:** Zamenom 6 tajmera (`[400, 1200, 2600, 5000, 8000, 12000]`) determinističkim `onLayout` merenjem sprečavaju se nepotrebni re-layout ciklusi u prvih 12 sekundi na ekranu `Zadaci`.
3. **Dinamički uvoz `lazniIzvor.ts`:** Sprečava učitavanje 1.200+ linija dev-mock podataka u produkcioni JS bundle pri pokretanju aplikacije.
4. **Zaustavljanje `useBreath()` petlje van fokusa:** Sprečava trošenje baterije i CPU-a na ekranima koji su u pozadini navigacionog steka.

---

## 3. Spremnost za Google Play Store (Checklista)

| Zahtev Google Play prodavnice | Trenutno stanje u USKOČI | Šta još treba uraditi pre objave na Play Store |
|---|---|---|
| **Brisanje naloga u aplikaciji (In-App Account Deletion)** | **SPREMNO:** Ekran `/profil/zatvaranje-naloga` (`ClosurePresentation.tsx`) + trofazni `uskoci-account-closure-worker`. | Primeniti pripremljenu migraciju `20261021104455` na serveru i postaviti javni web link za zahtev za brisanje naloga van aplikacije (Play Console uslov). |
| **Izvoz ličnih podataka (GDPR / ZZPL)** | **SPREMNO:** Ekran `/profil/izvoz-podataka` (`ExportPresentation.tsx`) + `uskoci-data-export-worker` & `download`. | Potvrditi aktivnost u `edge_worker_tick_v5`. |
| **Politika privatnosti i Uslovi korišćenja u aplikaciji** | **DELIMIČNO (`src/app/pravno/privatnost.tsx`, `uslovi.tsx`):** Ekrani postoje i jasno su strukturisani, ali sadrže označene nepoznate podatke o pravnom licu (matični broj, PIB, sedište firme, DPO kontakt). | Vlasnik treba da dostavi konačne podatke firme (naziv, PIB, MB, adresa, kontakt email) i javne HTTPS URL-ove za Play Console. |
| **Android dozvole (`permissions`)** | Koriste se: `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` (samo u prvom planu za izbor tačke na mapi / deljenje lokacije), `RECORD_AUDIO` (glasovni unos u AI/chatu), `READ_MEDIA_IMAGES` / kamera (fotografije zadatka/dogovora), `POST_NOTIFICATIONS`. | Proveriti da u `app.config.ts` nisu uključene pozadinske lokacijske dozvole (`ACCESS_BACKGROUND_LOCATION` **ne sme** postojati jer aplikacija ne prati radnike u pozadini). |
| **Potpisivanje i format paketa** | `eas.json` ima profile za build. | Za Google Play produkciju obavezno graditi **Android App Bundle (`.aab`)** potpisan produkcionim upload ključem i ugasiti DEV zastavice (`USKOCI_GEMINI_PAID_TEST_ENABLED` -> produkcioni režim). |
