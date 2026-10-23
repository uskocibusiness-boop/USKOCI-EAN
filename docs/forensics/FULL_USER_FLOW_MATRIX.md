# USKOČI — FULL USER FLOW MATRIX (Matrica 20 korisničkih putanja)
**Presek stanja:** 22. oktobar 2026.  
**Obim:** Svih 20 ključnih životnih ciklusa korisnika (End-to-End)  
**Status verifikacije:** 100% koda i serverskih ugovora provereno na disku (`audit_journeys_matrix.json`)  
**Forenzički auditori:** Agent 01, Agent 05, Agent 08, Agent 09  

---

## 1. Tabela svih 20 korisničkih putanja

| ID | Korisnički tok | Ključni UI ekrani | Klijentski servisi | Edge / AI funkcija | Supabase RPC / Tabele | Status pokrivenosti |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **01** | **Registracija i prijava** | `auth.tsx`, `AuthPresentation.tsx` | `authClientService.ts`, `sesija.ts` | — | `auth.users`, `public.app_profiles` | **VERIFIED** |
| **02** | **AI Onboarding radnika** | `profil/razgovor.tsx`, `WorkerAiPresentation.tsx` | `workerAiClientService.ts` | `uskoci-worker-interview` | `private.worker_ai_sessions`, `ai_structured_facts` | **VERIFIED** |
| **03** | **Čuvanje profila radnika** | `WorkerProfileSaved.tsx` | `workerProfileClientService.ts` | — | `rpc_save_worker_capacity`, `rpc_set_worker_execution_modes` | **VERIFIED** |
| **04** | **Aktivacija radnika** | `profil/radnik.tsx` | `workerProfileClientService.ts` | — | `rpc_complete_worker_profile`, `app_profiles` | **VERIFIED** |
| **05** | **AI kreiranje zadatka** | `nova.tsx`, `IntakePresentation.tsx` | `aiNeedV2Production.ts` | `uskoci-ai-interview` | `ai_conversations`, `ai_messages`, `ai_structured_facts` | **VERIFIED** |
| **06** | **Čuvanje nacrta zadatka** | `pregled-zadatka.tsx` | `aiTaskReviewClientService.ts` | — | `rpc_prepare_ai_task_review_taxonomy`, `rpc_ai_need_review_v2` | **VERIFIED** |
| **07** | **Objava zadatka** | `pregled-zadatka.tsx`, `ReviewPresentation.tsx` | `aiTaskReviewClientService.ts` | — | `rpc_publish_accepted_ai_task_review`, `needs` | **VERIFIED** |
| **08** | **Klasifikacija taksonomije**| Pozadina pri objavi | — | `uskoci-ai-interview`, `classificationEngine.mjs` | `taxonomy_review_candidate_projection_v2`, `work_taxonomy_gemini_turn_hints_v1` | **VERIFIED** |
| **09** | **Matching i pretraga** | `zadaci.tsx`, `prilike.tsx` | `supabaseIzvor.ts` | — | `uskoci_marketplace_tick`, `rpc_list_open_tasks_v3` | **VERIFIED** |
| **10** | **Push notifikacije** | `obavestenja.tsx` | `activityMessageTargetService.ts` | `uskoci-push-transport` | `rpc_begin_push_send`, `rpc_set_push_device_owned` | **VERIFIED** |
| **11** | **Prijava na zadatak (Radnik)**| `prilike/[id]/prijava.tsx`, `ApplicationComposerPresentation.tsx` | `applicationSelectionClientService.ts`, `applicationCommandJournal.ts` | — | `rpc_submit_response`, `marketplace_responses` | **VERIFIED** |
| **12** | **Izbor radnika (Naručilac)**| `potrebe/[id]/kandidati.tsx`, `ApplicationSelectionPresentation.tsx` | `candidateClientService.ts` | — | `rpc_select_response`, `marketplace_responses`, `needs` | **VERIFIED** |
| **13** | **Kreiranje Dogovora** | `dogovor/[id].tsx`, `AgreementOverview.tsx` | `agreementClientService.ts` | — | `public.agreements`, `rpc_get_agreement_workspace` | **VERIFIED** |
| **14** | **1:1 Privatni chat** | `dogovor/[id].tsx`, `AgreementThreadPresentation.tsx` | `agreementMessageClientService.ts` | — | `agreement_messages`, `rpc_mark_agreement_messages_read` | **VERIFIED** |
| **15** | **Grupni chat (2+ radnika)** | `dogovor/[id]/grupa.tsx`, `GroupConversationPresentation.tsx` | `groupConversationService.ts` | — | `group_conversations_v5`, `group_first_admission_history` | **VERIFIED** |
| **16** | **Završetak posla i 48h sat**| `dogovor/[id].tsx` | `agreementClientService.ts` | — | `rpc_mark_work_done`, `rpc_confirm_completion` | **VERIFIED** |
| **17** | **Ocenjivanje i reputacija** | `oceni-dogovor.tsx` | `reviewsClientService.ts` | — | `rpc_submit_agreement_review_v2`, `account_reputations` | **VERIFIED** |
| **18** | **Zamena izvršioca** | `potrebe/[id]/kandidati.tsx` | `candidateClientService.ts` | — | `staged_task_replacement`, `cancelled_candidate_history_parity` | **VERIFIED** |
| **19** | **Otkazivanje saradnje** | `dogovor/[id].tsx`, `moje-prijave.tsx` | `agreementClientService.ts`, `myApplicationsClientService.ts` | — | `rpc_cancel_agreement`, `rpc_withdraw_response` | **VERIFIED** |
| **20** | **Brisanje naloga (GDPR)** | `profil/podesavanja.tsx` | `accountClosureClientService.ts` | `uskoci-account-closure-worker` | `rpc_prepare_account_closure`, `closure_taxonomy_archive_copy_coverage` | **VERIFIED** |

---

## 2. Detaljan forenzički prolaz kroz sržne tokove

### Tok 07: Objava zadatka (`/pregled-zadatka`)
* **Ulaz:** Korisnik završi AI razgovor na `/nova`.
* **Izvršenje:** Klijent poziva `rpc_prepare_ai_task_review_taxonomy`.
* **Serverska provera:** Server validira `need.category`, lokaciju i handoff. Računa `displayedContentDigest`.
* **Potvrda:** Korisnik klikne „Objavi zadatak“. Klijent šalje `rpc_publish_accepted_ai_task_review(reviewId, clientRequestId)`.
* **Ishod:** Zadatak dobija status `PUBLISHED`, vidljiv je na mapi i pokreće se dispečer.

### Tok 11 & 12: Prijavljivanje i Izbor izvršioca
* **Prijava radnika:** Radnik na `/prilike/[id]/prijava` unosi cenu i mesta. Server poziva `rpc_submit_response`. Ponuda dobija status `SUBMITTED`.
* **Izbor naručioca:** Naručilac na `/potrebe/[id]/kandidati` vidi listu prijavljenih, bira radnika i poziva `rpc_select_response`.
* **Atomska tranzicija:**
  - Kreira se bilateralni zapis u `public.agreements`.
  - Ako je zadatak tražio 3 čoveka, status zadatka prelazi u `SELECTION` (1/3).
  - Kada se popuni i treće mesto (3/3), status prelazi u `ACTIVE`.
  - Radnik dobija push notifikaciju da je izabran.

### Tok 13 & 14: Dogovor i Zaštita kontakata (`access_grants`)
* **Radni prostor:** Oba korisnika ulaze u `/dogovor/[id]`.
* **Zaštita privatnosti:** Broj telefona je zaštićen RLS-om. Tek kada naručilac klikne dugme **„Podeli broj telefona“**, server poziva `rpc_set_contact_grant(agreement_id, 'PHONE', worker_account_id)`.
* **Otkrivanje:** Radnik poziva `rpc_reveal_contact` i na svom ekranu vidi pravi broj telefona.

### Tok 16 & 17: Završetak posla i Ocene
* **Oznaka završetka:** Radnik klikne „Označi posao završenim“. Server poziva `rpc_mark_work_done(agreement_id)`. Stanje ugovora prelazi u `AWAITING_REQUESTER`.
* **Sat od 48 sati:** Naručilac ima 48 sati da potvrdi završetak ili prijavi problem (`rpc_report_problem`).
* **Potvrda:** Naručilac klikne „Potvrdi završetak“ -> `rpc_confirm_completion` -> ugovor dobija status `COMPLETED`.
* **Ocene:** Otključava se ruta `/oceni-dogovor`. Obe strane unose 1–5 zvezdica i komentar, što osvežava javni rejting u tabeli `account_reputations`.

---

## 3. Zaključak matrice

Svih 20 tokova ima **potpuno implementiranu bazu, klijentske servise i definisane ekrane**. Nema „nepostojećih“ ili izmišljenih delova arhitekture — celokupan funkcionalni kostur je završen i povezan.
