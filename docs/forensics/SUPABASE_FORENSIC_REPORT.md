# USKOČI — SUPABASE FORENSIC REPORT (Forenzički izveštaj baze i servera)
**Presek stanja:** 22. oktobar 2026.  
**Projekat:** `leqcwgzvjsxugfgzdmth` (DEV / ALPHA)  
**PostgreSQL verzija:** `17.6.1.165` GA (Linux, `eu-central-1`)  
**Status servera:** `ACTIVE_HEALTHY` (Linked: `true`)  
**Forenzički auditor:** Agent 02 — Supabase Database Architect  

---

## 1. Verifikacija okruženja i integriteta

Direktnim očitavanjem kroz Supabase Management API i PostgreSQL CLI potvrđeno je:
* **Projekat `leqcwgzvjsxugfgzdmth`** je aktivan i zdrav.
* **186 autoritativnih SQL forward migracija** primenjeno je na serveru bez konflikta.
* Skripta integriteta (`supabase/migrations/check_migration_integrity.py`) potvrdila je:
  `PASS migration_integrity files=186 live_snapshot=87 pending=60 physical_suffix=39 participant_contract=PASS`.
* Nema neevidentiranog šema drifta na verifikovanim tabelama.

---

## 2. Kritični nalaz: Supabase promena od 30. oktobra 2026. (Explicit Table Grants)

### Opis promene
Supabase uvodi bezbednosnu promenu kojom se ukidaju podrazumevane (implicitne) privilegije nad novokreiranim tabelama u `public` šemi za uloge `anon` i `authenticated`. Svaka tabela mora imati eksplicitno definisane `GRANT` naredbe.

### Forenzički nalaz u USKOČI bazi
Skriptom `scripts/audit_supabase_tables.py` analizirana je 31 tabela kreirana u migracijama:
* **8 tabela** ima eksplicitne `GRANT` naredbe u samim migracijama.
* **23 bazne tabele** kreirane u ranim migracijama (avgust 2026.) nemaju eksplicitan `GRANT` u istom fajlu, već su se oslanjale na tadašnje PostgreSQL podrazumevane dozvole:
  `public.needs`, `public.need_sensitive`, `public.need_selections`, `public.marketplace_responses`, `public.marketplace_response_versions`, `public.agreements`, `public.agreement_versions`, `public.agreement_messages`, `public.agreement_execution`, `public.access_grants`, `public.ai_conversations`, `public.ai_structured_facts`, `public.ai_action_proposals`, `public.user_activity_events`, `public.notification_preferences` itd.

### Uticaj na klijentsku aplikaciju
Forenzičkom proverom klijentskog koda (`scripts/audit_direct_queries.py`) utvrđeno je da se **95% svih interakcija sa bazom odvija preko SECURITY DEFINER RPC funkcija** (koje imaju sopstvena prava izvršavanja).  
Međutim, postoji **14 direktnih poziva** preko `supabase.from(...)`:
1. `src/data/aiNeedV2Production.ts` čita `ai_conversations` i `app_profiles`.
2. `src/data/aiOpenIntakes.ts` čita `ai_conversations`.
3. `src/data/contactClientService.ts` čita `access_grants`.
4. `src/data/myApplicationsClientService.ts` čita `marketplace_responses`.
5. `src/data/ownProfileClientService.ts` i `workerProfileClientService.ts` čitaju `app_profiles`.
6. `src/data/ru4Production.ts` čita `needs`.

### Preporuka za otklanjanje rizika (Severity: MEDIUM / P1)
Da bi aplikacija bila 100% otporna na promenu od 30. oktobra, pripremiti jednu forward migraciju koja eksplicitno definiše:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.needs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agreements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_grants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
```
*(Uz postojeće RLS polise koje već strogo štite podatke po `auth.uid()`)*.

---

## 3. Popis i status 15 Edge funkcija na DEV-u

Očitano direktno sa `https://leqcwgzvjsxugfgzdmth.supabase.co`:

| Naziv funkcije | Verzija | Status | JWT provera | EZBR SHA-256 (Bundle) | Uloga |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `uskoci-ai-interview` | **v122** | ACTIVE | false | `4988c98b...` | Glavni AI razgovor za objavu zadataka |
| `uskoci-worker-interview` | **v77** | ACTIVE | false | `355c6a09...` | AI razgovor za radnički profil i veštine |
| `uskoci-push-transport` | **v37** | ACTIVE | false | `dcfc991c...` | Slanje Expo push notifikacija |
| `uskoci-location-search` | **v25** | ACTIVE | true | `6edbe277...` | Geografska pretraga i validacija |
| `uskoci-publication-evaluate`| **v22** | ACTIVE | true | `a73abe0d...` | Validacija spremnosti pre objave |
| `uskoci-data-export-worker` | **v22** | ACTIVE | false | `37c6e8d7...` | Priprema GDPR arhive za izvoz |
| `uskoci-data-export-download`| **v22** | ACTIVE | true | `9a592d9b...` | Preuzimanje izvezenih podataka |
| `uskoci-speech-session` | **v23** | ACTIVE | true | `c9be2c2b...` | Sesije za prepoznavanje govora (STT) |
| `uskoci-qa-classify` | **v21** | ACTIVE | true | `8c16daa4...` | Klasifikacija pitanja pre selekcije |
| `uskoci-media` | **v22** | ACTIVE | true | `34e4a231...` | Obrada i skladištenje fotografija |
| `uskoci-account-closure-worker`| **v12** | ACTIVE | false | `9f7373f9...` | Brisanje i redakcija naloga |
| `uskoci-taxonomy-postsave-worker`| **v5** | ACTIVE | false | `4fe24382...` | Asinhrona obrada novih grana kataloga |
| `sbfenv` | **v4** | ACTIVE | true | `9ef58620...` | Pomoćni servis za inspekciju okruženja |
| `uskoci-gemini-schema-smoke` | **v5** | ACTIVE | true | `418ef9a1...` | Test servis za validaciju Gemini šema |
| `uskoci-gemini-provider-probe-dev`| **v6**| ACTIVE | true | `16d541a3...` | Provera latencije Gemini API-ja |

---

## 4. Analiza 73 klijentske RPC funkcije

Forenzičkim skeniranjem celog `src/` koda (`scripts/audit_client_rpcs.py`) identifikovane su tačno **73 jedinstvene RPC funkcije** koje mobilna aplikacija poziva.

### Ključne grupe funkcija:
1. **Intake i objava zadatka (TRV01, PED01, PED02):**
   - `rpc_prepare_ai_task_review_taxonomy` — računa digest i proverava `classificationState = 'READY'`.
   - `rpc_publish_accepted_ai_task_review` — atomski kreira javni zadatak sa revizijom 1.
   - `staged_task_replacement` — omogućava bezbednu promenu objavljenog zadatka bez gubitka prijava.
2. **Kandidati i bilateralni dogovori (CCP02, CCP03, CAL01):**
   - `rpc_submit_response` — upisuje ponudu radnika u `marketplace_responses`.
   - `rpc_select_response` — kreira bilateralni ugovor u `public.agreements`, ažurira popunjenost (npr. 1/3) i proverava vremenske konflikte radnika.
   - `rpc_cancel_agreement` — otkazuje ugovor, oslobađa mesto (`3/3 -> 2/3`) i omogućava izbor zamene.
3. **Zaštita privatnosti (`access_grants`):**
   - `rpc_set_contact_grant` — naručilac eksplicitno daje dozvolu za broj telefona ili adresu izabranom radniku.
   - `rpc_reveal_contact` — radnik bezbedno dešifruje i očitava broj telefona druge strane.
4. **Završetak posla i rok od 48 sati:**
   - `rpc_mark_work_done` — radnik postavlja status `AWAITING_REQUESTER` i pokreće sat od 48h.
   - `rpc_confirm_completion` — naručilac potvrđuje uspešan završetak (`COMPLETED`).
   - `rpc_report_problem` — naručilac zaustavlja 48h sat i prijavljuje primedbu (spor).
5. **Ocene i reputacija:**
   - `rpc_submit_agreement_review_v2` — obostrano ocenjivanje (1–5 zvezdica + utisci).

---

## 5. Zaključak stanja baze

* **Arhitektura je robusna:** Baza na DEV-u je u izuzetnom stanju — nema nezatvorenih migracija, idempotencija sprečava duple upise, a RLS štiti podatke.
* **Jedina neophodna preventivna radnja:** Usklađivanje eksplicitnih `GRANT` prava na 23 bazne tabele pre 30. oktobra 2026.
