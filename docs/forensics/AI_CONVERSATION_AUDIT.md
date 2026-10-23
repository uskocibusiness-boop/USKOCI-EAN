# USKOČI — AI CONVERSATION & TAXONOMY AUDIT (Revizija AI razgovora i taksonomije)
**Presek stanja:** 22. oktobar 2026.  
**Predmet audita:** Edge funkcije `uskoci-ai-interview` (v122) i `uskoci-worker-interview` (v77)  
**Modeli:** Google Gemini 2.5 Flash / Gemini Omni  
**Forenzički auditori:** Agent 03 (Gemini AI Conversation Engineer) & Agent 04 (Classification & Matching Specialist)  

---

## 1. Zašto USKOČI ima taksonomiju i zašto ona ne sme da se ukine

Jedno od ključnih pitanja u arhitekturi jeste: **zašto AI razgovor mora biti povezan sa stablom kategorija u bazi?**

Forenzičkim uvidom u SQL migracije (`20261019085714_taxonomy_query_catalog_service.sql`, `20261018144207_taxonomy_new_branch_scope_continuity.sql` i `20261021103954_task_review_writer_readiness.sql`) potvrđeno je:
1. **USKOČI nije statički oglasnik:** Korisnik ne bira zanimanja iz krutog menija, već u slobodnom razgovoru na srpskom jeziku kaže šta mu treba (npr. *"Treba mi izrada 3D figurica sa slanjem"*).
2. **Autonomno širenje stabla usluga:**
   Kada naručilac unese novu uslugu koja do tada nije postojala u bazi, AI kroz funkciju `private.taxonomy_review_candidate_projection_v2` ima ulogu da:
   - Proveri da li slična usluga već postoji (`REUSE_EXISTING` ili `REUSE_ALIAS`).
   - Ako ne postoji, predloži grananje pod postojećeg roditelja (`CREATE_CHILD`), npr. roditelj: *Izrada predmeta / Prototipiranje*.
   - Ako je u pitanju potpuno novo područje, predloži korensku granu (`CREATE_NEW_BRANCH`).
   - Definiše mod rada: `ON_SITE` (na licu mesta) ili `REMOTE` (sa kurirskim slanjem / handoff).
3. **Zašto je ovo neophodno za objavu i matching:**
   Funkcija objave `rpc_prepare_ai_task_review_taxonomy` eksplicitno zahteva:
   ```sql
   and r.envelope ? 'classificationState'
   and r.envelope->>'classificationState' = 'READY'
   ```
   Ako Gemini ne pripremi predlog u tabeli `private.work_taxonomy_gemini_turn_hints_v1`, baza zadatak označava kao `PENDING_CLASSIFICATION`, i **naručilac ne može da objavi zadatak**.  
   Štaviše, cron proces `uskoci_marketplace_tick` radnicima šalje notifikacije samo ako se njihov profil poklapa sa tim tačnim `categoryId` i modom rada.

**Zaključak:** Taksonomija je arhitektonska prednost USKOČI-ja i mora ostati aktivna.

---

## 2. Anatomija problema: Zašto je AI bio spor (8–10 sekundi)

Iako je poslovna uloga taksonomije jasna, **način na koji je ona trenutno izvršavana tokom razgovora guši odziv modela**:

### Šta se dešava u kodu `supabase/functions/uskoci-ai-interview/index.ts` (linije 810–860):
* U sistem je ubačen `taxonomyExplorer` koji registruje funkciju alata:
  ```typescript
  tools: [{ declaration: taxonomyToolDeclaration, execute: async (args) => taxonomyExplorer.execute(args) }]
  ```
* Kada korisnik pošalje običnu poruku (npr. *"Novi Sad, centar"* ili *"Odgovara mi subota"*), Gemini pokreće **multi-turn tool loop**:
  1. *Turn 1:* Gemini poziva alat `taxonomy_catalog (SEARCH)` da pretražuje bazu.
  2. *Turn 2:* Edge funkcija izvršava SQL upit nad bazom i vraća podatke Gemini-ju.
  3. *Turn 3:* Gemini analizira odgovor, proverava šeme i tek onda generiše tekst odgovora.
* **Rezultat:** Za jednu običnu poruku prave se **2 do 3 mrežna poziva ka Gemini API-ju i bazi**. Vreme čekanja raste na **8 do 10 sekundi**, a prompt troši ogromnu količinu tokena na tehnička pravila umesto na topao i kratak dijalog.

---

## 3. Rešenje: Jednokratni direktni prolaz (Direct Classification)

U repozitorijumu **već postoji pripremljen mehanizam** koji eliminiše ovo kašnjenje:  
Modul `supabase/functions/_shared/classificationDirectReply.mjs` i funkcija `canAcceptDirectClassification`.

### Kako sistem treba da radi:
1. **Razgovor teče u 1 koraku (Single Shot):**  
   Gemini dobija poruku i odmah, u jednom jedinom pozivu, vraća:
   - Kratak, topao ljudski odgovor na srpskom jeziku (za korisnika na telefonu).
   - Strukturirani JSON objekat sa prepoznatim činjenicama i `classificationShadow` predlogom (`REUSE_EXISTING`, `CREATE_CHILD` ili `CREATE_NEW_BRANCH`).
2. **Nema pozivanja alata u toku četa:**  
   Gemini ne mora da u realnom vremenu lista stablo baze dok korisnik kuca adresu ili termin. Njegov izlaz se validira direktno na serveru.
3. **Rezultat:**  
   - Latencija pada sa 8–10 sekundi na **1.5 do 2 sekunde**.
   - Baza dobija sve potrebne podatke u `work_taxonomy_gemini_turn_hints_v1`.
   - `classificationState` uredno postaje `READY`.
   - Zadržava se 100% inteligencije i širenja baze novim uslugama.

---

## 4. Analiza oba toka razgovora

### A. Razgovor za objavu zadatka (`/nova` — `uskoci-ai-interview` v122)
* **Ekrakcija činjenica (`ai_structured_facts`):**
  - `need.description` — opis posla.
  - `need.category` — konkretna usluga (radnja + predmet, npr. *Krečenje zidova*, *Izrada 3D figurica*).
  - `need.task_geography` — `ON_SITE` (sa gradom) ili `REMOTE` (na daljinu).
  - `need.handoff` — za poslove na daljinu: kurirsko slanje ili lično preuzimanje.
  - `need.schedule_kind` — `FIXED_WINDOW` ili `FLEXIBLE`.
  - `need.price_mode` — `MY_PRICE` (sa iznosom u RSD) ili `OFFERS` (tražim ponude).
* **Završetak četa:**  
  Kada se prikupe 4 ključna stuba (opis, mesto, vreme, cena), AI daje jasan završni signal, a na dnu se prikazuje sažeta kartica sa dugmetom za pregled.

### B. Razgovor za profil radnika (`/profil/razgovor` — `uskoci-worker-interview` v77)
* **Prikupljanje veština:**
  - Radnik navodi čime se bavi.
  - AI prepoznaje konkretne usluge i vezuje ih za modove rada (`ON_SITE`, `REMOTE` ili oba).
  - Podešava se radijus i grad za rad na terenu, odnosno kurirski uslovi za rad na daljinu.
* **Čuvanje profila:**
  - `rpc_save_worker_capacity` i `rpc_set_worker_execution_modes` aktiviraju radnički profil.
  - Radnik odmah postaje kvalifikovan za matching u cron procesu.

---

## 5. Zaključak

* **AI sistem nije promašaj — on je tehnološki najnapredniji deo platforme.**
* **Usklađivanjem transporta na `DirectReply`:** Zadržavamo tačan `canonicalId`, omogućavamo bazi da sama uči nova zanimanja kroz `CREATE_CHILD`, a korisnik dobija trenutan, prijatan i brz odziv na mobilnom telefonu.
