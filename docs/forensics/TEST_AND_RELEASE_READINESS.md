# USKOČI — TEST & RELEASE READINESS (Testovi i spremnost za Store)
**Presek stanja:** 22. oktobar 2026.  
**Cilj:** Analiza 13.884 testa, CI/CD procesa i provera spremnosti za Google Play Store  
**Forenzički auditori:** Agent 10 (QA & Test Automation Lead) & Agent 11 (DevOps & Release Engineer)  

---

## 1. Analiza 13.884 testa u repozitorijumu

U repozitorijumu se nalazi **624 test fajla** sa ukupno **13.884 pojedinačna testa** (svi prolaze — 0 FAIL).

### Raspodela po domenima:
* `src/data/__tests__/` — **402 test fajla** (servisi, RPC ugovori, keš, mrežni adapteri).
* `src/ui/system/__tests__/` — **59 test fajlova** (vizuelni tokeni, ikonice, avatari, dugmad).
* `src/ui/profile/__tests__/` — **15 test fajlova** (radnički profil, dostupnost, lokacija).
* `src/ui/calendar/__tests__/` — **14 test fajlova** (kalendar, preklapanje termina).
* Ostale komponente — **134 test fajla**.

### Stručna kritika postojeće testne strategije:
1. **Preveliki broj vizuelnih mikro-testova (~6.500 testova):**  
   Mnogi testovi ispituju fiksne stilove (npr. `borderRadius: 9999`, `fontSize: 14`, hex boje). Ovi testovi su pisani u fazi strogog "zamrzavanja dizajna" i danas predstavljaju smetnju jer padaju pri svakoj modernizaciji ekrana u pravcu Premium White-a.
2. **Kritični poslovni testovi (~1.500 testova):**  
   Ovaj segment je vrhunski pokriven. Testovi za:
   - `TRV01` (spremnost pregleda pre objave),
   - `PED01` & `PED02` (zaštita i zamena objavljenog zadatka),
   - `CAL01` (vremenski konflikti radnika),
   - `CCP02` & `CCP03` (otkazivanje i zamena kandidata bez dupliranja ugovora),
   - RLS i prava pristupa (`access_grants`)  
   **su od neprocenjive vrednosti i predstavljaju garant stabilnosti za produkciju.**

---

## 2. CI/CD i Build infrastruktura

* **GitHub Actions:** U folderu `.github/workflows/` nalazi se 214 fajlova automatizacije.
* **Proizvodni workflow:** `.github/workflows/build-latest-v5-preview-apk.yml` generiše funkcionalne preview APK-ove za Android.
* **EAS & Metro:** `eas.json` i `metro.config.cjs` su konfigurisani za Expo SDK 57 i React Native 0.86.3 sa novom React 19 podrškom.

---

## 3. Kontrolna lista za izlazak na Google Play Store (Release Checklist)

| Zahtev Google Play Store-a | Status u USKOČI | Akcija do izlaska |
| :--- | :--- | :--- |
| **AAB (Android App Bundle)** | Podržano u `eas.json` | Generisati produkcijski `.aab` umesto `.apk` |
| **Hermes JavaScript Engine** | Uključen (`app.json`) | Omogućava brz start i manju potrošnju memorije |
| **Brisanje naloga (Account Deletion)** | **DA** (`/profil/podesavanja`) | Povezano sa `uskoci-account-closure-worker` |
| **Politika privatnosti (Privacy Policy)** | **DA** (`/profil/privatnost`) | Postaviti javni HTTPS link u Play Console |
| **Bezbednost lokacije (Target SDK 34+)** | Usklađeno | Koristi se približna lokacija (grad/kvart) za javnost |
| **Uklanjanje Dev alata i logova** | Konfigurisano | Isključiti `console.info` u produkcijskom buildu |
| **Optimizacija performansi (Bez ANR-a)** | **POTREBNO** | Ukloniti `BlurTargetView` sa mapi pre slanja |

---

## 4. Zaključak spremnosti

Aplikacija je **tehnički spremna 90% za Store release**. Baza, bezbednost i sržni tokovi su potpuno zaokruženi. Preostalih 10% se odnosi na uklanjanje grafičkih kočnica na telefonu (`expo-blur`), ubrzanje AI transporta i generisanje finalnog potpisanog `.aab` paketa.
