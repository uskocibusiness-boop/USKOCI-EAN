# 19 — Architectural Decisions & Verification Evidence

## 1. Ključne arhitekturne odluke (ADR)

### ADR-01: Razdvajanje AI razgovora na „Dva mala Geminija u paru" (`Dual-Gemini`)
- **Kontekst:** Objedinjeni poziv (`USKOCI_TAXONOMY_UNIFIED_SHADOW`) u kom jedan Gemini poziv istovremeno vodi razgovor, čita delimični katalog, generiše `classificationShadowJson` i ulazi u višekratne tool-call petlje trajao je **11–18 sekundi po poruci**.
- **Odluka:** Razdvojiti tok u `uskoci-ai-interview` i `uskoci-worker-interview`:
  - **Gemini #1 (Brzi Sagovornik):** Vodi isključivo prirodan razgovor na srpskom jeziku (sa emotikonima 🙂) i izvlači činjenice zadatka/profila bez blokiranja na taksonomiji.
  - **Gemini #2 (Pozadinski Arhitekta stabla — `backgroundTaxonomyArchitect.mjs`):** Učitava i kešira **celo stablo taksonomije** (svih 140+ kategorija kroz sve nivoe) u memoriji Edge instance po `catalogVersion + catalogFingerprint`. Postojeće usluge (`REUSE_EXISTING`) i proširenje načina rada (`EXTEND_MODE`) rešava u **0ms** u memoriji, a samo za zaista nove usluge (`CREATE_CHILD`) poziva fokusirani Gemini #2 klasifikator koji vidi celo stablo i kešira odluku u `cachedNovelDecisions`.
- **Dokaz:** Svih 215 ugovornih testova (`owned_intake_edge.test.mjs`, `v5_worker_edge.test.mjs`, `dynamic_taxonomy/*.test.mjs`) prolazi 100%, a oba Edge servisa su objavljena na `leqcwgzvjsxugfgzdmth`.

### ADR-02: Očuvanje stanja mape, pina, skrola i filtera pri povratku (`discoveryV1WarmReturn.ts`)
- **Kontekst:** Korisnik na ekranu `Zadaci` pomeri mapu, uključi filtere, klikne na pin i otvori detalj zadatka (`/prilike/[id]`), pa klikne Nazad.
- **Odluka i dokaz u kodu:** `src/ui/v2/DiscoveryV1Route.tsx` (linije 456–601), `src/lib/discoveryV1WarmReturn.ts` (linije 1–103) i `src/ui/DiscoveryMap.tsx` (linije 116–224) čuvaju u memoriji (sa rokom od 5 minuta, vezano za `accountKey`) tačan centar i zum mape (`mapCenter`, `mapZoom`), izabrani pin (`selectedTaskId`), poziciju skrola liste (`listScrollOffset`), otvorenost donjeg lista (`sheetSnapIndex`) i sve aktivne filtere (`view`). Pri povratku sa detalja zadatka stanje se vraća trenutno bez skakanja mape na početnu tačku.

### ADR-03: Dvostrana potvrda završetka zadatka + 48h automatsko zaključivanje + pauziranje pri prijavi problema
- **Kontekst:** Šta se dešava ako radnik obavi posao i označi `Zadatak je gotov`, a naručilac zaboravi da uđe u aplikaciju, ili obrnuto ako postoji spor?
- **Odluka i dokaz u kodu:**
  1. `rpc_mark_work_done` postavlja `state = 'AWAITING_REQUESTER'` i `requester_deadline_at = now() + 48 hours`.
  2. `pg_cron` svakog minuta izvršava `uskoci_marketplace_tick` -> `rpc_tick_auto_completion()`, koji posle 48 sati automatski zaključuje Dogovor u `COMPLETED` i ažurira `needs.status` (`private.sync_need_completion`) **samo ako nije prijavljen problem (`problem_opened_at IS NULL`)**.
  3. Ako bilo koja strana klikne `Prijavi problem` (`rpc_report_problem`), `problem_opened_at` zaustavlja automatski tajmer od 48 sati dok se problem ne reši.

### ADR-04: Svesno i smerno deljenje telefona i tačne adrese (`access_grants`)
- **Kontekst:** Zaštita privatnosti korisnika pre i posle sklapanja Dogovora.
- **Odluka i dokaz u kodu:** `public.need_sensitive` i `public.access_grants` (`20260830072818_clean_scoped_contact_reveal.sql`) garantuju da ni sklapanje Dogovora ne otkriva automatski telefon ili tačnu adresu. Svaka strana svesno deli i može da opozove svoj kontakt kroz `rpc_set_contact_grant` / `rpc_reveal_contact`.
