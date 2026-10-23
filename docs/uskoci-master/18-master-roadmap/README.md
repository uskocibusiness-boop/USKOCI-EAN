# 18 — Master Implementation Roadmap (Redosled izvođenja po fazama)

Ovaj plan utvrđuje tačan, logičan redosled izvršavanja preostalih radova od baze podataka do završnog APK/AAB paketa.

---

## FAZA 1: AI Brzina i Pozadinski Arhitekta stabla („Dva mala Geminija u paru") — **ZAVRŠENO I OBJAVLJENO NA DEV**
- [x] Izgrađen `supabase/functions/_shared/backgroundTaxonomyArchitect.mjs` koji drži **celo stablo taksonomije** (svih 140+ kategorija kroz sve nivoe) u memoriji, u 0ms rešava `REUSE_EXISTING` i `EXTEND_MODE`, a za nove usluge (`CREATE_CHILD`) poziva fokusiranog Geminija #2 sa uvidom u celo stablo.
- [x] Povezano u `uskoci-ai-interview/index.ts` i `uskoci-worker-interview/index.ts` tako da Gemini #1 vodi čist, brz razgovor na srpskom jeziku bez blokiranja na katalogu.
- [x] Svih **215/215** testova u `owned_intake_edge.test.mjs`, `v5_worker_edge.test.mjs` i `dynamic_taxonomy/*.test.mjs` prolazi.
- [x] Objavljeno na kanonski Supabase DEV (`leqcwgzvjsxugfgzdmth`).

---

## FAZA 2: Konsolidacija Baze, Dozvola za 30.10.2026. i Matching unapređenja (Backend P0)
1. **Eksplicitne `GRANT SELECT` dozvole pre 30.10.2026.:**
   - Napisati i primeniti forward migraciju koja daje eksplicitni `GRANT SELECT ON TABLE ... TO authenticated` za 11 tabela (`marketplace_responses`, `marketplace_response_versions`, `need_selections`, `agreements`, `agreement_versions`, `agreement_execution`, `user_activity_events`, `ai_structured_facts`, `worker_match_preferences`, `dispatch_rounds`, `opportunity_deliveries`).
2. **Primena pripremljenih migracija na DEV (`20261019104047`, `20261019104604`, `20261021103645`, `20261021104455`):**
   - Uključiti direktan deep-link za push obaveštenja o novim prijavama (`20261021103645`) i osvežiti potpis brisanja naloga (`20261021104455`).
3. **Unapređenje Matching pravila za realne životne situacije:**
   - Kada je radnikov profil `ACTIVE` i `available_now = true`, a nema unetih ograničenja u kalendaru (`profile_availability_rules` je prazno), dozvoliti podudaranje i za buduće zakazane zadatke (`TOMORROW_FLEXIBLE`, `WEEK_FLEXIBLE`, `FIXED_WINDOW`).
   - Povezati više područja rada (`evaluate_worker_coverage_v1` / `workAreas`) u `worker_need_fit_v1` i `candidate_profile_ids`.

---

## FAZA 3: Otključavanje P0/P1 Korisničkih Tokova u Klijentskoj Aplikaciji (Frontend Core UX)
1. **Ekran Zadaci (`DiscoverySearchBar.tsx` + `DiscoverySearchPanel.tsx`):**
   - Otključati već izgrađenu pretragu po ključnoj reči i gradu (`openPanel('search')`) direktno iz gornje trake pretrage na ekranu `Zadaci`.
2. **Radni profil i AI Radni profil (`radnik.tsx`, `WorkerProfilePresentation.tsx`, `WorkerProfileSaved.tsx`, `razgovor.tsx`):**
   - Povezati `checks` i `readyToActivate` u `WorkerProfileForm`.
   - Ukloniti duplo dugme `"Uredi kroz razgovor"` i postaviti `"Započni kroz razgovor"` za novi profil.
   - Omogućiti ulaz u `"Nedeljni raspored"` i kada je profil `ACTIVE`, i učiniti red `"Šta radiš"` klikabilnim.
   - Prikazati `"Potvrdi tačku na mapi"` uvek kada tačka nije potvrđena.
   - Urediti `profil/razgovor.tsx` u čistom „ChatGPT mobilnom“ stilu (bez teškog headera, samo povratak nazad + diskretna akcija, završna kartica tek na kraju kada je profil spreman) i objediniti teme razgovora.
3. **AI Objava i Pregled zadatka (`nova.tsx`, `IntakePresentation.tsx`, `pregled-zadatka.tsx`):**
   - Urediti `nova.tsx` / `IntakePresentation.tsx` u čistom „ChatGPT mobilnom“ stilu (bez teškog headera i bez žive kartice tokom kucanja; `DraftCard` izlazi na kraju razgovora kada je `readyForReview === true`).
   - Ukloniti placebo harmoniku `"Dodaj još podataka"` sa 5 neklikabilnih redova na `pregled-zadatka.tsx` (ili je povezati sa dopunom kroz razgovor).
4. **Kandidati, Vlasnički pregled i Dogovor (`ApplicationSelectionPresentation.tsx`, `potrebe/[id]/pregled.tsx`, `AgreementWorkspace.tsx`):**
   - Proslediti `reason={choice.reason}` na dugme `"Izaberi"` kod kandidata.
   - Proslediti `publishedAt` na vlasničkom pregledu zadatka kako bi `"Objavljen pre..."` i R16 pomoć posle 24h radili.
   - Ukloniti ugnježdeni skrol četa (`AgreementChat`) sa dna `Pregled` taba u Dogovoru u korist čistog prelaza na pun ekran poruka.

---

## FAZA 4: Vizuelno i Motion Ujednačavanje po `PREMIUM_WHITE_CANON.md` + Čišćenje Tehničkog Duga
1. Zameniti preostale sive skeletone (`StateView.tsx`, `ListSkeleton.tsx`, `ReceivedReviewsList.tsx`, `ReviewCommentsSection.tsx`) komponentom `<QuietReadState />` i obrisati `RadarIcon.tsx`.
2. Ujednačiti `AccountSettingsPresentation.tsx`, `AiHistoryListScreen.tsx`, `ProfileHubPresentation.tsx` i `EntryWelcome.tsx` sa sistemskim tokenima (`SettingsScreen`, `Segmented`, `sys.type`).
3. Zameniti `BlurView` u `SearchBackdrop.tsx` čistim Reanimated scrim-om, zaustaviti `useBreath()` (`Arrive.tsx`) van fokusa, spojiti `Reduce Motion` hookove i prebaciti `lazniIzvor` u `src/data/index.ts` na uslovni dev import.

---

## FAZA 5: Puna E2E Verifikacija, Novi APK za HONOR Telefon i Priprema za Play Store
1. Pokrenuti sve jedinice, ugovorne i E2E testove.
2. Izgraditi i instalirati osveženi APK (`adb install -r`) na povezani HONOR telefon i verifikovati stvarne tokove.
3. Uneti konačne pravne podatke firme u `privatnost.tsx` i `uslovi.tsx` i pripremiti produkcioni `.aab` paket za Google Play Console.
