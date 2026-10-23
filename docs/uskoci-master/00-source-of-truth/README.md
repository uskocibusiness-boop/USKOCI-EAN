# 00 — Source of Truth & System Baseline

**Datum preseka:** 23.10.2026.  
**Aktivni repozitorijum:** `c:\Users\user\Desktop\USKOCI ZAVRSAVANJE\USKOCI-EAN`  
**Aktivna grana:** `feature/unified-qa-master-20261017`  
**Kanonski Supabase DEV projekat:** `leqcwgzvjsxugfgzdmth` (`https://leqcwgzvjsxugfgzdmth.supabase.co`)  
**Kanonski vizuelni ugovor:** `docs/implementation/design-system/PREMIUM_WHITE_CANON.md`  
**Kanonski način rada:** `AGENTS.md` (autonomni režim od 18.10.2026.)

---

## 1. Šta je jedini izvor istine (Single Source of Truth)

U ranijim fazama razvoja nastao je veliki broj prelaznih planova (`docs/authority/history/`, `docs/forensics/`, `supabase/candidates/`). Od ovog preseka važi sledeća hijerarhija izvora istine:

1. **Izvršni kod klijenta (`src/**`) i Edge funkcija (`supabase/functions/**`)** — definiše šta aplikacija zaista izvršava.
2. **Stvarna PostgreSQL šema i RPC funkcije na kanonskom DEV serveru (`leqcwgzvjsxugfgzdmth`) + `supabase/migrations/**`** — definišu stvarne tabele, RLS politike, okidače (`triggers`) i poslovna pravila.
3. **`docs/uskoci-master/MASTER_SYSTEM_AND_PRODUCT_BLUEPRINT.md`** i prateći moduli `00`–`19` u `docs/uskoci-master/` — objedinjena arhitekturna, proizvodna, UX/UI i inženjerska specifikacija.
4. **`docs/implementation/design-system/PREMIUM_WHITE_CANON.md` + `src/ui/system/tokens.ts`** — jedini važeći dizajn sistem (**USKOČI Premium White**).

---

## 2. Ključni forenzički nalazi o stanju izvora istine

### 2.1 Klijentska aplikacija (Expo SDK 55 / React Native 0.83.2 / React 19.2.0)
- Aplikacija ima **56 ruta** u `src/app/` organizovanih kroz Expo Router (`(auth)`, `(onboarding)`, `(app)`, `dogovor/[id]`, `podrska`, `pravno`, `profil`).
- Glavna navigacija je reducirana na **5 čistih tabova** (`src/ui/BottomTabBar.tsx`):
  1. **Početna** (`/(app)/home`)
  2. **Zadaci** (`/(app)/zadaci`)
  3. **+ Objavi** (`/(app)/nova`)
  4. **Dogovori** (`/(app)/dogovori`)
  5. **Profil** (`/(app)/profil`)
- **Produkciona čistoća podataka:** `src/data/index.ts` na liniji 67 eksplicitno zabranjuje bilo kakav `lazniIzvor` (mock podatke) van `__DEV__ && EXPO_PUBLIC_ENABLE_DEV_MOCK === '1'`. Svi ekrani u produkciji čitaju isključivo sa Supabase servera.

### 2.2 Supabase migracije vs. `supabase/candidates/`
- U `supabase/migrations/` nalazi se **188 SQL migracija** (`20260825115040` do `20261021104455`).
- **Kritičan nalaz:** Između `20260913081242` i `20261013192000`, više migracija je primenjeno direktno na kanonski DEV server iz `supabase/candidates/` (npr. `dynamic-taxonomy-20261011/dev-dark-launch-locked.sql`, `pkg045b_task_column_privileges_p0.sql`, `pkg028a_edge_workers_scheduled.sql`, `worker-coverage-20261018/live-worker-need-fit.sql`) bez kopiranja u `supabase/migrations/`.
- **Pravilo za dalje:** Svaka primenjena promena iz `supabase/candidates/` mora biti formalno uvedena u `supabase/migrations/` i `MIGRATION_PROVENANCE.json` kako bi čista provera baze (`supabase db reset`) bila 100% reproduktivna.

### 2.3 Edge funkcije (12 funkcija u `supabase/functions/`)
1. `uskoci-ai-interview` — AI razgovor za objavu i izmenu zadatka (**Dual-Gemini** arhitektura).
2. `uskoci-worker-interview` — AI razgovor za kreiranje i dopunu radnog profila (**Dual-Gemini** arhitektura).
3. `uskoci-taxonomy-postsave-worker` — Asinhroni post-save radnik za upis odobrenih grana taksonomije i povezivanje (`bind`) zadataka i radnika.
4. `uskoci-publication-evaluate` — Evaluacija objave zadatka i usklađenost sa pravilima.
5. `uskoci-qa-classify` — Klasifikacija javnih pitanja i odgovora pre izbora radnika.
6. `uskoci-location-search` — Serverska pretraga lokacija i geokodiranje.
7. `uskoci-speech-session` — Glasovni unos i transkripcija.
8. `uskoci-media` — Bezbedan upload/download medija (`profile-media`, privatne fotografije u Dogovoru).
9. `uskoci-push-transport` — Slanje Expo push obaveštenja i provera potvrda (`receipts`).
10. `uskoci-data-export-worker` — Asinhrono generisanje izvoza korisničkih podataka (GDPR/Zakon o zaštiti podataka).
11. `uskoci-data-export-download` — Preuzimanje izvezenog paketa podataka.
12. `uskoci-account-closure-worker` — Trofazno brisanje i anonimizacija naloga (`STORAGE_DELETE` → `RELATIONAL_REDACT` → `AUTH_IDENTITY_ERASE`).
