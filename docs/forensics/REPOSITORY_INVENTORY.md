# USKOČI — REPOSITORY INVENTORY (Popis repozitorijuma)
**Presek stanja:** 22. oktobar 2026.  
**Grana:** `feature/unified-qa-master-20261017`  
**Git HEAD:** `ababbdbcc70ee08df4408cfb318a5d028188d168`  
**Režim analize:** READ-ONLY Forenzički pregled 11.535 fajlova  

---

## 1. Globalna statistika fajlova

| Segment | Broj fajlova | Procenat | Opis i uloga |
| :--- | :--- | :--- | :--- |
| **Klijentski izvorni kod (`src/` bez testova)** | **729** | 6.3% | Stvarni TypeScript/React Native kod koji se pakuje u APK |
| **Klijentski testovi (`src/**/__tests__`)** | **624** | 5.4% | Jest jedinični, mock i integracioni testovi (13.884 tvrdnji) |
| **Supabase SQL migracije** | **193** | 1.7% | 186 primenjenih forward migracija + skripte integriteta |
| **Supabase Edge funkcije** | **51** | 0.4% | Deno/TypeScript kod za 15 aktivnih mikroservisa |
| **Supabase kandidati i dokazi (`proofs/`)** | **1.616** | 14.0% | SQL rollback testovi, istorijski preflight dokazi |
| **Dokumentacija (`docs/`)** | **3.077** | 26.7% | 103 aktuelna, 168 autoritetna, 2.727 istorijskih izveštaja |
| **Izvorni Android native kod (`android/`)** | **3.024** | 26.2% | Gradle, Kotlin, C++ i biblioteke Expo prebuild-a |
| **Lokalni radni tragovi (`work/`)** | **1.237** | 10.7% | Logovi emulatora, UI snimci, XML dumpovi ekrana |
| **Lokalni native moduli (`modules/`)** | **290** | 2.5% | Namenski Expo moduli (npr. zvučni i audio mehanizmi) |
| **CI/CD automatizacija (`.github/`)** | **214** | 1.9% | GitHub Actions workflow fajlovi i skripte za build |
| **Pomoćne skripte i alati (`scripts/`)** | **132** | 1.1% | Skripte za proveru integriteta, EAS pripremu i proveru patcheva |
| **Vizuelni i audio resursi (`assets/`)** | **133** | 1.1% | Ikone, fontovi, splash ekrani, ilustracije |
| **Konfiguracija i korenski fajlovi** | **215** | 1.9% | `package.json`, `app.json`, `tsconfig.json`, `metro.config.cjs` |
| **UKUPNO PRATI SE U REPOZITORIJUMU** | **11.535** | **100%** | Celokupno stanje repozitorijuma |

---

## 2. Anatomija klijentskog koda (`src/`)

Klijentski kod je organizovan u **11 logičkih domena**:

```
src/
├── app/          (56 fajlova)  — Expo Router rute ekrana
├── ui/           (384 fajla)   — Prezentacione komponente, teme, kartice, forme
├── data/         (169 fajlova) — Klijentski servisi, RPC adapteri, Supabase klijent
├── contracts/    (30 fajlova)  — TypeScript ugovori podataka, tipovi i šeme
├── hooks/        (23 fajla)    — Reaktivni hook-ovi (inbox, push, tajmeri, tastatura)
├── lib/          (21 fajl)     — Pomoćne funkcije (vreme, novac, formati, inicijali)
├── features/     (14 fajlova)  — Biznis logika specifičnih funkcionalnosti
├── store/        (7 fajlova)   — Lokalno stanje sesije i keširanje
├── bootstrap/    (3 fajla)     — Inicijalizacija aplikacije i runtime okruženja
├── theme/        (2 fajla)     — Globalni vizuelni stilovi
└── designLab/    (22 fajla)    — Izolovane razvojne laboratorije i galerije
```

### Inspekcija ruta (`src/app/` — 56 ruta)
Sve rute su povezane preko Expo Router-a u tri nivoa:
1. **Root nivo:** `_layout.tsx`, `auth.tsx`, `oporavak.tsx`, `obavestenja.tsx`, `+native-intent.tsx`.
2. **Glavni App Stack `(app)/`:**
   - Pretraga i mapa: `index.tsx`, `zadaci.tsx`, `mapa.tsx`, `mesto-zadatka.tsx`.
   - Objavljivanje: `nova.tsx`, `pitanja-zadatka.tsx`, `fotografije-zadatka.tsx`, `pregled-zadatka.tsx`, `pregled-nacrta.tsx`.
   - Vlasnik zadatka: `potrebe.tsx`, `potrebe/[id]/pregled.tsx`, `potrebe/[id]/kandidati.tsx`.
   - Radnik i prilike: `prilike.tsx`, `prilike/[id].tsx`, `prilike/[id]/prijava.tsx`, `moje-prijave.tsx`.
   - Profil i podešavanja: `profil.tsx`, `profil/radnik.tsx`, `profil/razgovor.tsx`, `profil/podesavanja.tsx`, `profil/izvoz.tsx`.
3. **Radni prostor Dogovora `dogovor/[id]`:**
   - `dogovor/[id].tsx` (Glavni bilateralni ekran: Pregled, Poruke, Telefon, Završetak).
   - `dogovor/[id]/grupa.tsx` (Grupni razgovor za poslove sa više radnika).
   - `dogovor/[id]/izmene.tsx` (Predlog i prihvatanje izmena uslova).

---

## 3. Popis Supabase funkcija i servisa

U repozitorijumu se nalazi **12 Edge funkcija** u `supabase/functions/`:
1. `uskoci-ai-interview` (AI razgovor za objavu zadatka, Gemini Flash, hibridna klasifikacija)
2. `uskoci-worker-interview` (AI intervju radnika za postavljanje profila i veština)
3. `uskoci-push-transport` (Transport notifikacija ka Expo Push servisima)
4. `uskoci-location-search` (Pretraga gradova i naselja bez curenja tačnih adresa)
5. `uskoci-publication-evaluate` (Procena potpunosti zadatka pre konačnog upisa)
6. `uskoci-data-export-worker` (Priprema arhiva podataka korisnika po GDPR-u)
7. `uskoci-data-export-download` (Zaštićeno preuzimanje izvezenih podataka)
8. `uskoci-speech-session` (Sesije za glasovni unos i prepoznavanje govora)
9. `uskoci-qa-classify` (Klasifikacija javnih pitanja i odgovora pre prijave)
10. `uskoci-media` (Obrada, kompresija i provera fotografija zadataka)
11. `uskoci-account-closure-worker` (Asinhrono brisanje i redakcija ličnih podataka)
12. `uskoci-taxonomy-postsave-worker` (Asinhrona obrada novih predloženih grana kataloga)

---

## 4. Zaključak popisa

* **Stvarni kod proizvoda je zdrav i kompaktan:** Klijent (`src/`) ima 729 operativnih fajlova i 56 ruta. To je potpuno razuman i pregledan obim za moderan marketplace.
* **Glavni volumen repozitorijuma čine arhivi:** 3.077 markdown fajlova u `docs/` i 1.616 SQL dokaza u `supabase/proofs/` nastali su tokom višemesečnog rigoroznog beleženja dokaza prethodnih timova.
* **Nijedan fajl nije ignorisan ili izgubljen:** Svaki fajl u stablu je popisan i mapiran u `docs/forensics/AUDIT_COVERAGE_LEDGER.json`.
