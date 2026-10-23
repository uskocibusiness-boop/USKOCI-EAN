# USKOČI — MASTER SYSTEM & PRODUCT BLUEPRINT

**Datum preseka:** 23.10.2026.  
**Repozitorijum:** `c:\Users\user\Desktop\USKOCI ZAVRSAVANJE\USKOCI-EAN` (`feature/unified-qa-master-20261017`)  
**Kanonski Supabase DEV:** `leqcwgzvjsxugfgzdmth` (`https://leqcwgzvjsxugfgzdmth.supabase.co`)  
**Vizuelni kanon:** `docs/implementation/design-system/PREMIUM_WHITE_CANON.md`  
**Autoritet:** Glavni arhitekta proizvoda i inženjeringa (koordinacija 16 specijalizovanih agenata)

---

## 1. Executive Summary (Za vlasnika proizvoda — bez skrivanja i bez žargona)

### Šta je dobro (Čvrsti temelji koji su već izgrađeni)
1. **Ozbiljan i bezbedan backend (`Supabase PostgreSQL` + `Edge Functions`):**
   - Nijedna tabela u bazi ne dozvoljava direktno menjanje sa telefona (`REVOKE INSERT, UPDATE, DELETE`); svaka akcija prolazi kroz serverske `SECURITY DEFINER` RPC funkcije i transakcione okidače (`triggers`).
   - Privatnost je zaštićena na nivou baze: javni zadaci imaju samo okvirnu lokaciju (~1.1 km mreža), dok se tačna adresa (`public.need_sensitive`) i telefon dele isključivo svesnom odlukom u okviru Dogovora (`access_grants`).
2. **Dva mala Geminija u paru (`Dual-Gemini` arhitektura — upravo ugrađena i objavljena na DEV):**
   - **Gemini #1 (Brzi Sagovornik)** vodi prirodan, topao razgovor na srpskom jeziku (sa emotikonima 🙂) i izvlači podatke zadatka ili radnog profila bez čekanja na taksonomiju.
   - **Gemini #2 (Pozadinski Arhitekta stabla — `backgroundTaxonomyArchitect.mjs`)** u pozadini (`EdgeRuntime.waitUntil`) vidi **celo stablo taksonomije** (svih 140+ kategorija kroz sve nivoe u memoriji), u **0ms** prepoznaje postojeće usluge (`REUSE_EXISTING`) i proširenja načina rada (`EXTEND_MODE`), a za nove usluge (`CREATE_CHILD`) bira tačnu granu i upisuje je u bazu bez usporavanja ćaskanja.
3. **Potpun životni ciklus Dogovora, Završetka i Ocena u bazi i kodu:**
   - Prijava na zadatak (`rpc_submit_response`), izbor više izvršilaca (`0/2 → 1/2 → 2/2`, `rpc_select_response`), automatski grupni razgovor za 2+ radnika (`group_conversations_v5`), otkazivanje uz automatsko ponovno traženje zamene (`rpc_cancel_agreement`), dvostrana potvrda završetka (`Zadatak je gotov` → `Potvrdi završetak`), automatsko zaključivanje posle **48 sati** neaktivnosti (`rpc_tick_auto_completion`), zaustavljanje tajmera pri prijavi problema (`rpc_report_problem`) i dvostrano ocenjivanje (`rpc_submit_agreement_review_v2`) su **100% izgrađeni**.
4. **Pamćenje stanja mape i liste (`discoveryV1WarmReturn.ts`):**
   - Kada korisnik na ekranu `Zadaci` pomeri mapu, uključi filter, klikne na pin i uđe u zadatak pa se vrati nazad, centar mape, zum, izabrani pin, skrol pozicija liste i filteri ostaju sačuvani (5-minutni topli keš).

### Šta nije dobro i šta trenutno ne radi u UI-u (Konkretni nalazi iz koda)
1. **[P0 — ZADACI] Pretraga po reči i gradu postoji u kodu, ali je 100% zaključana u UI-u:**
   - U `DiscoverySearchPanel.tsx` (linije 289–435) postoji kompletno napravljen ekran pretrage po ključnoj reči i gradu (`mode === 'search'`), ali `DiscoverySearchBar.tsx` na vrhu ekrana otvara isključivo `openPanel('filters')`, a unutar filtera dugme za pretragu je skriveno iza uslova `view.query.trim()` (koji je na početku uvek prazan!). Zato korisnik uopšte ne može da ukuca reč ili grad u pretragu.
2. **[P0 — RADNI PROFIL] Šest povezanih grešaka u prikazu Radnog profila (`radnik.tsx`, `WorkerProfilePresentation.tsx`, `WorkerProfileSaved.tsx`, `razgovor.tsx`):**
   - Ček-lista za aktivaciju (`checks={{ basics, area }}`) se izračunava u `radnik.tsx:318`, ali je `WorkerProfileForm` u `WorkerProfilePresentation.tsx:169` ignoriše i hardkoduje `readyToActivate={false}`.
   - Kada je profil aktivan, u `WorkerProfileSaved.tsx:93` red **„Nedeljni raspored"** je greškom sakriven iza uslova `!availableNow`, pa aktivan radnik ne može da otvori svoj raspored!
   - Na aktivnom profilu se pojavljuju **dva identična zelena dugmeta „Uredi kroz razgovor"** (jedno u kartici, drugo u futeru), a za novog korisnika dugme kaže „Uredi kroz razgovor" umesto „Započni kroz razgovor".
   - Red **„Šta radiš"** (`SkillsRow`) nije klikabilan (za razliku od „Područje dolaska" i „Dostupnost").
   - Dugme **„Potvrdi tačku na mapi"** (`WorkerProfileSaved.tsx:90`) nestaje čim AI upiše grad u `workAreas`, pa radnik ne vidi gde da potvrdi tačku na mapi dok aktivacija ne vrati grešku.
   - U AI razgovoru za radni profil (`razgovor.tsx:427`) prosleđeno je `card={() => null}`, pa se živa kartica `WorkerAiCard` ne vidi tokom razgovora.
3. **[P0 — AI OBJAVA I PREGLED ZADATKA] Skrivena živa kartica tokom razgovora i placebo harmonika na pregledu:**
   - U `IntakePresentation.tsx:395`, živa kartica (`showSummary`) se prikazuje tek kada je ceo zadatak 100% spreman za pregled (`readyForReview`), umesto da raste tokom razgovora kako AI prikuplja činjenice.
   - Na ekranu `pregled-zadatka.tsx` (linije 660–667), harmonika **„Dodaj još podataka"** otvara 5 statičnih redova `"Nema navedenih stavki"` na koje ne može da se klikne.
4. **[P0 — BAZA / 30.10.2026.] Jedanaest `public` tabela nema eksplicitan `GRANT SELECT ... TO authenticated` u migracijama:**
   - Zbog promene Supabase pravila najavljene za **30.10.2026.**, tabele `marketplace_responses`, `marketplace_response_versions`, `need_selections`, `agreements`, `agreement_versions`, `agreement_execution`, `user_activity_events`, `ai_structured_facts`, `worker_match_preferences`, `dispatch_rounds` i `opportunity_deliveries` moraju dobiti eksplicitan `GRANT SELECT` u forward migraciji.
5. **[P0 — MATCHING U REALNOM ŽIVOTU] Prazan kalendar blokira sve buduće zadatke:**
   - U `worker_need_time_tier_v1` (`20261018141946`), ako radnik uključi „Dostupan sam" (`available_now = true`), ali nije uneo nedeljne smene u kalendar (`profile_availability_rules` je prazno), matcher vraća prazan opseg `{}` i radnik **ne dobija nijedan zadatak za sutra ili sledeću nedelju**! Takođe, podrška za više područja rada (`evaluate_worker_coverage_v1`) napisana je u `supabase/candidates/`, ali još nije povezana u glavni matcher.

### Šta predlažem i šta je prioritet (Redosled kojim odmah rešavamo sve)
1. **Prioritet 1 (Već urađeno u ovom koraku):** Razdvojena i objavljena **Dual-Gemini** arhitektura za oba AI razgovora (`uskoci-ai-interview` i `uskoci-worker-interview`).
2. **Prioritet 2 (Backend P0):** Primeniti `GRANT SELECT` migraciju za 11 tabela pre 30.10.2026., primeniti 4 spremne migracije na DEV (`20261019104047`, `20261019104604`, `20261021103645`, `20261021104455`), i popraviti matching za radnike sa praznim kalendarom i više područja rada.
3. **Prioritet 3 (Frontend P0/P1):** Otključati pretragu na ekranu `Zadaci`, popraviti svih 6 tačaka na `Radnom profilu`, uključiti žive kartice tokom oba AI razgovora, ukloniti placebo harmoniku na `pregled-zadatka.tsx`, dodati `reason` na dugme `Izaberi` kod kandidata i ukloniti ugnježdeni čet na dnu `Pregleda` Dogovora.
4. **Prioritet 4 (Design & Motion Polish):** Zameniti preostale sive skeletone mirnim stanjem čitanja (`QuietReadState`), ujednačiti `Podešavanja` i `AI Istoriju` na belom platnu, ukloniti `BlurView` iz `SearchBackdrop.tsx` i zaustaviti `useBreath()` animaciju van fokusa.

---

## 2. Product Vision & Core Principles
Detaljno obrađeno u [`docs/uskoci-master/01-product-definition/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/01-product-definition/README.md):
- **Jedan čovek — jedan nalog:** Svaki korisnik može i da objavljuje zadatke i da aktivira svoj Radni profil.
- **AI-first bez duplih formulara:** Prirodan razgovor + jedna živa kartica + jedan završni pregled bez olovčica pored svakog polja.
- **Dosledna semantika načina rada (`ON_SITE` vs `REMOTE` + `handoff`):** Istovetno značenje u razgovoru, pregledu, bazi, taksonomiji i matcheru.
- **Svesno deljenje privatnih podataka:** Telefon i tačna adresa dele se tek u Dogovoru, svesnom akcijom vlasnika podatka.

---

## 3. Current System Forensics
Detaljno u [`docs/uskoci-master/00-source-of-truth/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/00-source-of-truth/README.md) i [`02-system-architecture/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/02-system-architecture/README.md):
- **Klijent:** 56 Expo Router ruta u `src/app/`, 67 servisa u `src/data/` sa strogim `readOwnedResult` dekoderima i `AsyncStorage` idempotentnim dnevnicima komandi.
- **Server:** 12 Edge funkcija u `supabase/functions/`, 188 migracija u `supabase/migrations/` + kandidati u `supabase/candidates/`.

---

## 4. Target Architecture
- Troslojna arhitektura sa strogom granicom: **React Native / Expo Router klijent** → **Supabase Edge Functions (Dual-Gemini, Media, Push, Closure, Export, PostSave Worker)** → **PostgreSQL (`public.rpc_*` SECURITY DEFINER + `private.*` domensko jezgro)**.
- Svi asinhroni procesi (push transport, post-save taksonomija, auto-kompletiranje posle 48h, izvoz podataka, brisanje naloga) vođeni su iz baze preko `pg_cron` (`uskoci_marketplace_tick` i `uskoci_edge_workers`).

---

## 5. Complete User Roles & Account Model
- `public.app_accounts` (`id = auth.uid()`): Jedinstveni identitet korisnika (`email`, `phone`, `full_name`, `city`, `active_role`).
- `public.app_profiles`: Dva reda po nalogu (`kind = 'REQUESTER'` i `kind = 'WORKER'`), automatski kreirana pri registraciji okidačem `on_auth_user_created_seed_cloud_foundation`.
- Prelazak između objavljivanja zadatka i rada kao izvršilac ne zahteva promenu naloga niti odjavljivanje.

---

## 6. End-to-End User Journeys
Detaljno u [`docs/uskoci-master/08-ux-and-user-flows/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/08-ux-and-user-flows/README.md):
1. **Registracija i prijava** (`EntryWelcome` → `auth.tsx` → `home`).
2. **Objava zadatka kroz AI** (`nova.tsx` → živa kartica → `pregled-zadatka.tsx` + `mesto-zadatka.tsx` → `uskoci-publication-evaluate` → `PUBLISHED`).
3. **Kreiranje i aktivacija Radnog profila** (`profil/radnik` → `profil/razgovor` → pregled i čuvanje → `profil/lokacija?mode=point` → `ACTIVE`).
4. **Otkrivanje i prijava na zadatak** (`zadaci.tsx` mapa/lista/pretraga ili Push `OPPORTUNITY_AVAILABLE` → `prilike/[id]` → `prilike/[id]/prijava`).
5. **Izbor radnika i sklapanje Dogovora** (`potrebe/[id]/kandidati` → `Izaberi` → `dogovor/[id]` + grupni chat `dogovor/[id]/grupa` za 2+ radnika).
6. **Izvršenje, potvrda završetka i dvostrana ocena** (`Zadatak je gotov` → `Potvrdi završetak` ili 48h auto-završetak → `oceni-dogovor.tsx`).

---

## 7. Information Architecture & Navigation Map
- **5 glavnih tabova (`BottomTabBar.tsx`):**
  1. `Početna` (`/(app)/home`)
  2. `Zadaci` (`/(app)/zadaci`)
  3. `+ Objavi` (`/(app)/nova`)
  4. `Dogovori` (`/(app)/dogovori`)
  5. `Profil` (`/(app)/profil`)
- **Sekundarne rute:** `/obavestenja`, `/poruke`, `/prilike/[id]`, `/prilike/[id]/prijava`, `/potrebe/[id]/pregled`, `/potrebe/[id]/kandidati`, `/dogovor/[id]`, `/dogovor/[id]/grupa`, `/dogovor/[id]/izmene`, `/oceni-dogovor`, `/profil/radnik`, `/profil/razgovor`, `/profil/lokacija`, `/profil/dostupnost`, `/profil/podesavanja`, `/profil/privatnost`, `/profil/izvoz-podataka`, `/profil/zatvaranje-naloga`, `/ai-istorija`, `/podrska/*`, `/pravno/*`.

---

## 8. Screen-by-Screen Functional & UX Specification
Kompletna specifikacija svih ekrana nalazi se u [`docs/uskoci-master/09-screen-specifications/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/09-screen-specifications/README.md).

---

## 9. AI Task Intake Specification (Dual-Gemini)
Detaljno u [`docs/uskoci-master/04-ai-interviews/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/04-ai-interviews/README.md):
- **Gemini #1 (`uskoci-ai-interview`):** Prirodan srpski razgovor sa emotikonima 🙂, izvlači `NEED_FACT_SCHEMA_V2` činjenice (`need.title`, `need.category`, `need.description`, `need.task_geography`, `need.handoff`, `need.schedule_kind`, `need.starts_at`, `need.ends_at`, `need.price_mode`, `need.price_rsd`, `need.price_basis`, `need.people_needed`).
- **Gemini #2 (`backgroundTaxonomyArchitect.mjs`):** Izvršava se neblokirajuće u pozadini (`runInBackground` / `EdgeRuntime.waitUntil`), vidi svih 140+ kategorija u memoriji i upisuje tačan taksonomski predlog u `rpc_taxonomy_capture_gemini_turn_hints_service`.

---

## 10. AI Worker Profile Intake Specification (Dual-Gemini)
- **Gemini #1 (`uskoci-worker-interview`):** Prirodan razgovor za `WORKER_PROFILE_V1` (`skills`, `bio`, `areaRequests` -> `workAreas`, `availabilityChange` -> `availability`). Ne ispituje radnika o alatu ili vozilima niti izmišlja zanate.
- **Gemini #2 (`buildWorkerFullTreeTaxonomyProposals` u `backgroundTaxonomyArchitect.mjs`):** U pozadini mapira sve ponuđene usluge radnika i njihove načine rada (`ON_SITE` / `REMOTE` + `handoff`) nad kompletnim stablom taksonomije i čuva hintove za potpisani pregled profila.

---

## 11. Taxonomy & Classification Specification
Detaljno u [`docs/uskoci-master/05-taxonomy-and-classification/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/05-taxonomy-and-classification/README.md):
- Četiri kanonske akcije: `REUSE_EXISTING`, `EXTEND_MODE` (sprečava duplikate kada ista usluga dobija novi način izvršenja), `CREATE_CHILD` (organizacioni roditelj ne ograničava mod deteta), `CREATE_NEW_BRANCH`.
- Upis u katalog vrši se isključivo nakon ljudske potvrde u Pregledu kroz `uskoci-taxonomy-postsave-worker`.

---

## 12. Matching, Availability & Dispatch Specification
Detaljno u [`docs/uskoci-master/06-matching-and-dispatch/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/06-matching-and-dispatch/README.md):
- Poklapanje po taksonomskom `category_id` (sa nasleđivanjem do 5 nivoa za standardne grane i tačnim poklapanjem za AI grane), načinu izvršenja (`ON_SITE` / `REMOTE`), `handoff` kompatibilnosti (kurir / lično preuzimanje), geografskom području (`workAreas` / Haversine radijus) i kalendaru dostupnosti (`worker_available_periods` sa podrazumevanom otvorenošću kada radnik uključi `available_now = true` bez unetih zabrana).

---

## 13. Task Lifecycle, Agreements & Completion Specification
Detaljno u [`docs/uskoci-master/11-agreements-and-chat/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/11-agreements-and-chat/README.md):
- Kompletan tok: `DRAFT` → `PUBLISHED` → `SELECTION` (`1/2`) → `ACTIVE` (`2/2`) → `AWAITING_REQUESTER` (`rpc_mark_work_done`, rok 48h) → `COMPLETED` (`rpc_confirm_completion` ili `rpc_tick_auto_completion`) → `Oceni saradnju` (`rpc_submit_agreement_review_v2`).

---

## 14. Chat & Privacy Sharing Specification
- 1-na-1 razgovor (`AgreementThreadPresentation.tsx`) sa podrškom za tekst, do 6 privatnih fotografija po poruci (`uskoci-media`) i glasovne poruke.
- Automatski grupni razgovor (`GroupConversationScreen.tsx`) za zadatke sa 2 ili više izabranih radnika.
- Svesno, smerno i opozivo deljenje telefona (`PHONE`) i tačne adrese (`EXACT_LOCATION`) kroz `rpc_set_contact_grant` i `rpc_reveal_contact`.

---

## 15. Push & In-App Notification Specification
Detaljno u [`docs/uskoci-master/07-notifications-and-push/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/07-notifications-and-push/README.md):
- Vezivanje tokena za aktivnu sesiju (`notification_push_devices`), dvofazni transport (`SEND` + 15-min `RECEIPT` u `uskoci-push-transport`), i autoritativno razrešavanje deep-linka pri dodiru (`useMessagePushIngress.ts`).

---

## 16. Visual Design System („USKOČI Premium White")
Detaljno u [`docs/uskoci-master/12-visual-design-system/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/12-visual-design-system/README.md):
- Belo platno (`#FFFFFF`), topla podloga (`#F7F8F7`), taman tekst (`#111613`), duboka zelena (`#1B6B4A`), topla narandžasta (`#E26D2D`), Plus Jakarta Sans tipografija, Phosphor linijske ikone (`Glyph`) + 2.5D semantičke ilustracije (`FactArt`), i mirno stanje čitanja (`QuietReadState`) bez sivih skeleton kartica.

---

## 17. Motion, Micro-Interactions & Haptics Specification
Detaljno u [`docs/uskoci-master/13-motion-and-interaction/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/13-motion-and-interaction/README.md):
- Reanimated UI-thread odziv na dodir (`usePressLift` + `expo-haptics`), poštovanje `Reduce Motion` postavke i obavezno zaustavljanje svih beskonačnih animacija (`useBreath`, `AiAssistantArt`) kada ekran nije u fokusu.

---

## 18. Database, RLS, RPC & Edge Function Specification
Detaljno u [`docs/uskoci-master/03-supabase-and-database/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/03-supabase-and-database/README.md):
- Obuhvata kompletnu mapu tabela, RLS politika, okidača, 12 Edge funkcija i listu od 11 tabela kojima se dodaje eksplicitni `GRANT SELECT ... TO authenticated` pre 30.10.2026.

---

## 19. Security, Privacy & Abuse Prevention Specification
Detaljno u [`docs/uskoci-master/14-security-and-privacy/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/14-security-and-privacy/README.md):
- Višeslojna zaštita: JWT + `session_id` validacija, RLS + kolonske privilegije, transakcioni GUC okidači, blokiranje brojeva telefona i linkova u javnim komentarima ocena (`REVIEW_COMMENT_CONTACT_NOT_PUBLIC`), i trofazno brisanje naloga kroz svih 67 relacija.

---

## 20. Technical Debt & Safe Removal Plan
Detaljno u [`docs/uskoci-master/15-refactoring-and-cleanup/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/15-refactoring-and-cleanup/README.md):
- 7 dokumentovanih stavki sa procenom rizika i proverom (`SearchBackdrop.tsx` BlurView, `Skeleton.tsx` / `ListSkeleton.tsx`, `RadarIcon.tsx`, statički import `lazniIzvor.ts`, duplirani `Reduce Motion` hookovi, `__DEV__` ograda za `designLab`, konsolidacija `supabase/candidates/`).

---

## 21. Testing & Verification Strategy
Detaljno u [`docs/uskoci-master/16-testing-and-e2e/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/16-testing-and-e2e/README.md):
- 5 nivoa verifikacije: 620 Jest klijentskih testova, 215/215 Node Edge/taksonomskih testova, 817 lokalnih SQL/PostgREST dokaza, živi DEV Gemini benchmark testovi i UI E2E skripte na fizičkom HONOR telefonu i emulatoru.

---

## 22. Release, OTA vs. Native Build & Play Store Readiness Plan
Detaljno u [`docs/uskoci-master/17-release-and-play-store/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/17-release-and-play-store/README.md).

---

## 23. Phased Master Implementation Roadmap
Detaljno u [`docs/uskoci-master/18-master-roadmap/README.md`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/uskoci-master/18-master-roadmap/README.md).

---

## 24. Product Completeness Matrix (14 kolona — Kompletan presek svih funkcionalnih celina)

| # | Funkcionalna celina / Ekran | Postoji u kodu | Radi end-to-end | Povezano u UI | Backend / DB spreman | RLS / Bezbednost | UX kvalitet | Vizuelna usklađenost | Animacije / Odziv | Edge slučajevi pokriveni | Pokriveno testovima | Kritičnost | Sledeća konkretna akcija |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **1** | **Auth, Prijava, Registracija i Oporavak (`auth.tsx`, `oporavak.tsx`, `EntryWelcome.tsx`)** | Da | Da | Da | Da (`Supabase Auth` + `on_auth_user_created`) | Da | Visok | Srednja (`EntryWelcome` koristi sopstvene fontove) | Dobar | Da (`authFlowMemory`) | Da (Jest + Android E2E) | **P2** | Prebaciti `EntryWelcome.tsx` na `sys.type` tokene i skratiti uvodne tekstove iznad tastature. |
| **2** | **Početna (`/(app)/home` — `MarketplacePresentation.tsx`)** | Da | Da | Da | Da (`rpc_list_open_tasks_v3`, `rpc_list_my_agreements`) | Da | Visok | Visoka (`Premium White`) | Dobar (`Press`, `Appear`) | Da | Da | **P2** | Prioritizovati prikaz „Čeka tvoju odluku" iznad ostalih sekcija kada ima aktivnih događaja. |
| **3** | **Zadaci — Mapa, Pinovi i Lista (`/(app)/zadaci` — `DiscoveryPresentation.tsx`)** | Da | Da (mapa/filteri) | **Delimično (Pretraga zaključana!)** | Da (`rpc_list_open_tasks_v3`) | Da (samo 29 javnih kolona + zaokružen pin) | **Blokiran za tekst/grad pretragu** | Visoka | `SearchBackdrop` koristi `BlurView`; `SHEET_KICKS_MS` | Da (5-min `discoveryV1WarmReturn` čuva mapu/pin/skrol/filtere) | Da | **P0** | Povezati `DiscoverySearchBar.tsx` sa `openPanel('search')`, ukloniti `BlurView` iz `SearchBackdrop.tsx` i `SHEET_KICKS_MS`. |
| **4** | **AI Objava zadatka (`/(app)/nova` — `uskoci-ai-interview` + `IntakePresentation.tsx`)** | Da | **Da (Dual-Gemini uživo na DEV!)** | **Delimično (živa kartica skrivena do kraja)** | Da (`rpc_ai_*_need_turn_v2_service`) | Da | Odličan razgovor, ali fali živa kartica tokom ćaskanja | Visoka | Dobar (`VoiceComposer`, `AiAssistantArt`) | Da (idempotentni `needTurnJournal`) | Da (215/215 Node + Jest) | **P0** | Prikazati kompaktnu živu karticu (`DraftCard` u `!final` režimu) u `IntakePresentation.tsx` čim postoji prva činjenica. |
| **5** | **Završni pregled i Objava zadatka (`pregled-zadatka.tsx`, `mesto-zadatka.tsx`, `uskoci-publication-evaluate`)** | Da | Da | **Delimično (placebo harmonika „Dodaj još podataka")** | Da (`rpc_prepare_ai_task_review_taxonomy`, `rpc_accept_ai_task_review`) | Da (SHA-256 potpis pregleda) | Harmonika otvara 5 neklikabilnih redova | Visoka (bez olovaka uz svako polje) | Dobar | Da (staged zamena objavljenog zadatka `20261021101159`) | Da | **P0** | Ukloniti 5 neklikabilnih `"Nema navedenih stavki"` redova u `pregled-zadatka.tsx` ili ih povezati sa dopunom kroz razgovor. |
| **6** | **AI Radni profil (`profil/razgovor.tsx` — `uskoci-worker-interview` + `WorkerAiPresentation.tsx`)** | Da | **Da (Dual-Gemini uživo na DEV!)** | **Delimično (`card={() => null}`)** | Da (`rpc_*_worker_ai_turn_service`) | Da | Nedostaje živa kartica tokom razgovora; 5 tema podeljeno u 2 menija | Visoka | Dobar | Da (`workerAiTurnJournal`, očuvanje postojećih veština i modova) | Da (215/215 Node + Jest) | **P0** | Uključiti `WorkerAiCard` u `razgovor.tsx:427` i objediniti svih 5 tema razgovora u jedan meni. |
| **7** | **Vlasnički Radni profil (`profil/radnik.tsx`, `WorkerProfilePresentation.tsx`, `WorkerProfileSaved.tsx`)** | Da | Da | **Ne (5 UI bagova)** | Da (`rpc_save_worker_ai_review`, `rpc_set_worker_availability`) | Da | `checks` ignorisan, duplo dugme, skriven `Nedeljni raspored`, neklikabilan `Šta radiš`, skriveno dugme za mapu | Visoka | Dobar | Da | Da | **P0** | Povezati `checks`, ukloniti duplo dugme, prikazati `Nedeljni raspored` za `ACTIVE`, učiniti `Šta radiš` klikabilnim i prikazati dugme za mapu. |
| **8** | **Dinamička taksonomija i Post-Save Binder (`backgroundTaxonomyArchitect.mjs`, `uskoci-taxonomy-postsave-worker`)** | Da | **Da (Celo stablo u memoriji)** | Da (kroz potpisani pregled) | Da (`private.work_taxonomy_*`) | Da (`private` šema, `authority='NONE'` za hintove) | Nevidljivo u pozadini (bez opterećivanja korisnika ID-jevima) | N/A (Backend) | **0ms za postojeće/EXTEND_MODE, neblokirajuće za nove** | Da (`REUSE_EXISTING`, `EXTEND_MODE`, `CREATE_CHILD`, `REMOTE` handoff) | Da (215/215 testova prolazi) | **Završeno (P0)** | Primeniti preostale 2 pripremljene migracije (`20261019104047`, `20261019104604`) na DEV ako nisu u tabeli migracija. |
| **9** | **Matching i Talasi slanja (`worker_need_fit_v1`, `worker_need_time_tier_v1`, `dispatch_next_wave`)** | Da | Da | Da (`Za mene` + Push prilike) | **Delimično (kalendar + `workAreas`)** | Da | Radnik sa praznim kalendarom ne vidi buduće zadatke | N/A (Backend) | `pg_cron` svakog minuta | Više mesta (`0/2 -> 1/2 -> 2/2`) radi; prazan kalendar i `workAreas` traže dopunu | Da | **P0** | Dozvoliti buduće zadatke kada je kalendar prazan a `available_now=true`, i povezati `evaluate_worker_coverage_v1` (`workAreas`). |
| **10** | **Prijave na zadatak i Izbor kandidata (`prilike/[id]/prijava`, `potrebe/[id]/kandidati`, `moje-prijave`)** | Da | Da | Da | Da (`rpc_submit_response`, `rpc_withdraw_response`, `rpc_select_response`) | **Fali `GRANT SELECT` za 30.10.2026.** | Na `kandidati.tsx` sivo dugme `Izaberi` nema `reason`; na `pregled.tsx` fali `publishedAt` | Visoka | Odličan (`SentReceipt`) | Da (više izvršilaca, zatvaranje/otvaranje preostale potrage) | Da | **P1** | Dodati `GRANT SELECT` migraciju, proslediti `choice.reason` na `Izaberi` i `publishedAt` na vlasnički pregled zadatka. |
| **11** | **Dogovori, Izvršenje, Otkazivanje i Završetak (`dogovori.tsx`, `dogovor/[id].tsx`, `izmene.tsx`)** | Da | Da | Da | Da (`rpc_mark_work_done`, `rpc_confirm_completion`, `rpc_tick_auto_completion`, `rpc_cancel_agreement`, `rpc_report_problem`) | **Fali `GRANT SELECT` za 30.10.2026.** | Ugnježdeni mini-čet (`AgreementChat`) na dnu `Pregled` taba stvara dupli skrol | Visoka na `Pregled`, neujednačena u `AgreementChat` | Dobar | Da (48h auto-završetak, pauza pri prijavi problema, automatsko traženje zamene pri otkazivanju) | Da | **P1** | Ukloniti ugnježdeni `AgreementChat` sa dna `Pregled` taba i ostaviti čist prelaz na pun ekran `Poruke`. |
| **12** | **Razgovori (1-na-1, Grupni chat, Fotografije, Glas, Deljenje kontakta/adrese)** | Da | Da | Da | Da (`rpc_send_agreement_message_v2`, `_photo_message_v5`, `_voice_message_v1`, `group_*_v5`, `rpc_set_contact_grant`) | Da (`need_sensitive` + `access_grants` RLS) | Odličan u `AgreementThreadPresentation` i `GroupConversationScreen` | Visoka (`MessageBubbles.tsx`) | Dobar | Da (opoziv kontakta, isključenje otkazanog člana iz grupe, jednokratni GPS) | Da | **P2** | Ujednačiti sve prikaze poruka na `MessageBubbles.tsx`. |
| **13** | **Dvostrano ocenjivanje i Reputacija (`oceni-dogovor.tsx`, `profil/[id].tsx`)** | Da | Da | Da | Da (`rpc_submit_agreement_review_v2`, `rpc_get_account_reputation`, `rpc_list_review_comments_v1`) | Da (`pre_v3_review_immutable` + zabrana kontakta u komentaru) | Visok (1–5 zvezdica, 6 pohvala, pisani komentar do 500 znakova, bez lažne zarade) | U listi ocena još postoje sivi skeletoni | Dobar | Da | Da (`d12_proof.mjs`) | **P2** | Zameniti sive skeletone u `ReceivedReviewsList.tsx` i `ReviewCommentsSection.tsx` sa `<QuietReadState />`. |
| **14** | **Push, Obaveštenja, Podešavanja, Privatnost, Izvoz i Brisanje naloga (`obavestenja.tsx`, `podesavanja.tsx`, `uskoci-push-transport`, `uskoci-account-closure-worker`)** | Da | Da | Da | **Primeniti `20261021103645` i `20261021104455` na DEV** | Da (67 relacija u brisanju naloga) | Visok | `podesavanja.tsx` i `ai-istorija.tsx` koriste `wash` boksove; `obavestenja` imaju `ListSkeleton` | `useBreath` u `Arrive.tsx` radi van fokusa | Da (verifikacija uređaja po sesiji, `DeviceNotRegistered` gašenje) | Da | **P1** | Primeniti 2 migracije na DEV, prebaciti `podesavanja.tsx` i `ai-istorija.tsx` na belo platno, zameniti `ListSkeleton` sa `QuietReadState` i zaustaviti `useBreath` van fokusa. |

---

## 25. Immediate Next Execution Actions (Sledeći koraci koje odmah izvršavamo po redu)

1. **Korak 1 (Backend P0):** Kreiranje i primena forward SQL migracije sa eksplicitnim `GRANT SELECT ... TO authenticated` za svih 11 tabela (spremnost za 30.10.2026.), primena pripremljenih migracija (`20261021103645`, `20261021104455`) i dopuna matching funkcije za radnike sa praznim kalendarom i više područja rada.
2. **Korak 2 (Frontend P0 — Zadaci & Radni profil & AI kartice):**
   - Otključavanje pretrage po reči i gradu u `DiscoverySearchBar.tsx` / `DiscoverySearchPanel.tsx`.
   - Popravka svih 6 stavki na Radnom profilu (`WorkerProfilePresentation.tsx`, `WorkerProfileSaved.tsx`, `radnik.tsx`, `razgovor.tsx`).
   - Uključivanje žive kartice tokom razgovora u `IntakePresentation.tsx` i rešavanje harmonike na `pregled-zadatka.tsx`.
3. **Korak 3 (Frontend P1/P2 — Dogovori, Kandidati, QuietReadState & Performanse):**
   - Prosleđivanje `choice.reason` na `ApplicationSelectionPresentation.tsx` i `publishedAt` na `potrebe/[id]/pregled.tsx`.
   - Čišćenje ugnježdenog četa u `AgreementWorkspace.tsx`, uklanjanje `BlurView` iz `SearchBackdrop.tsx`, zamena sivih skeletona sa `QuietReadState` i zaustavljanje `useBreath` van fokusa.
4. **Korak 4 (Verifikacija i APK isporuka):** Pokretanje testova, build i instalacija APK-a na HONOR telefon (`adb install -r`) i provera svih tokova uživo.
