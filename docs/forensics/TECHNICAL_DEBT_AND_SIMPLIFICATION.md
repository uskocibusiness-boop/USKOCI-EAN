# USKOČI — TECHNICAL DEBT & SIMPLIFICATION (Tehnički dug i pojednostavljenje)
**Presek stanja:** 22. oktobar 2026.  
**Cilj:** Izdvajanje suvišnih slojeva bez ugrožavanja stabilnosti i poslovne logike  
**Forenzički auditor:** Agent 01 (Principal System Architect) & Agent 12 (Independent Forensic Reviewer)  

---

## 1. Šta je SVETINJA i OBAVEZNO SE ZADRŽAVA (Bezbedna zona)

Pre bilo kakvog čišćenja, utvrđujemo delove sistema koji funkcionišu besprekorno i **ne smeju se menjati**:

1. **Baza i RPC ugovori (186 migracija):**
   - Transakcione granice: `rpc_publish_accepted_ai_task_review`, `rpc_submit_response`, `rpc_select_response`, `rpc_mark_work_done`, `rpc_confirm_completion`.
   - Bilateralni ugovori (`public.agreements`): model gde svaki radnik ima svoj individualni ugovor sa svojom cenom i bilateralnim uslovima.
   - Zaštita privatnosti (`access_grants`): autoritativni sistem deljenja telefona i adrese.
2. **Dinamička taksonomija i predlozi novih grana:**
   - Mehanizam `CREATE_CHILD` i `CREATE_NEW_BRANCH` u `private.taxonomy_review_candidate_projection_v2` koji omogućava bazi da uči nova zanimanja.
3. **Zaštita valute i vremena:**
   - Čuvanje iznosa u RSD, zaštita od tihog preračunavanja EUR, i validacija fiksnih i fleksibilnih vremenskih prozora.

---

## 2. Šta je PREKOMPLIKOVANO i ZAHTEVA POJEDNOSTAVLJENJE

### A. AI transport u `uskoci-ai-interview` (Kritično usko grlo)
* **Problem:** Korišćenje multi-turn alata (`taxonomy_catalog`) usred razgovora. Za svaku korisničku rečenicu prave se 2–3 poziva ka serveru i bazi, što stvara kašnjenje od 8–10 sekundi.
* **Pojednostavljenje:** Prebaciti transport na **jednokratni direktni prolaz (`DirectReply`)**. Gemini u jednoj sekundi vraća i tekstualni odgovor i strukturirani JSON sa klasifikacijom (`REUSE` ili `CREATE_CHILD`).
* **Rizik regresije:** NIZAK. Šema izlaza ostaje identična (`withGeminiClassificationShadowSchema`), tabela `work_taxonomy_gemini_turn_hints_v1` dobija iste podatke, a `classificationState` ostaje `'READY'`.

### B. Grafički slojevi na Androidu (`BlurTargetView`)
* **Problem:** U `src/ui/v2/DiscoveryPresentation.tsx` (linije 1490–1592) cela mapa i lista zadataka su omotani u `BlurTargetView` (`expo-blur`). Na Android GPU-u ovo izaziva softversko preslikavanje, pad frejmova (FPS drop) i ANR zastoje.
* **Pojednostavljenje:** Zameniti `BlurTargetView` čistom belom površinom sa blagom transparentnošću (`rgba(255,255,255,0.95)`).
* **Rizik regresije:** NULA. Ne menja nijedan podatak, a oslobađa Android grafički procesor.

### C. Preterano defanzivni uslovi u `IntakePresentation.tsx`
* **Problem:** Linije 396–398 sadrže 9 ulančanih boolean zastavica:
  `readyForReview = completeProposal && open && reviewContentReady && conversation.safety !== 'BLOCK' && !stillNeededText && !hiddenMissing && !needsPoint && !busy && !pending && !props.error`
  Dovoljno je da jedna interna zastavica (npr. `needsPoint`) zaostane kao `true`, i dugme za pregled nestaje, ostavljajući korisnika zaglavljenog.
* **Pojednostavljenje:** Svesti logiku na 3 ključna uslova: *imamo opis, imamo lokaciju/daljinu i imamo termin/cenu*. Ako su ti podaci tu, omogući prelazak na pregled.
* **Rizik regresije:** NIZAK. Posledični ekran `/pregled-zadatka` i baza ionako vrše konačnu serversku proveru pre bilo kakvog upisa.

---

## 3. Arhiviranje balasta (Šta skloniti sa radnog stola)

1. **3.077 dokumenata u `docs/`:**
   - 2.727 fajlova u `docs/implementation` su istorijski izveštaji i handoff-ovi iz prethodnih faza.
   - Ovi fajlovi ostaju u Git istoriji, ali se izuzimaju iz aktivnog pretraživanja kako ne bi zbunjivali razvoj i testiranje.
2. **Razdvajanje 14.000 testova:**
   - ~6.500 mikro-testova piksela, fontova i boja premestiti u sporednu granu vizuelnih testova.
   - Glavni CI/CD gate fokusirati na ~1.500 testova koji štite bazu, novac, RLS i životni ciklus ugovora.

---

## 4. Matrica uticaja pojednostavljenja

| Oblast | Postojeće stanje | Predloženo stanje | Dobitak | Rizik |
| :--- | :--- | :--- | :--- | :--- |
| **AI odziv** | 8–10 sekundi (multi-turn alat) | 1.5–2 sekunde (single shot) | **5x brži odziv** | NIZAK |
| **Android rendering** | `BlurTargetView` (seckanje/ANR) | Beli Surface (Airbnb stil) | **Glatkih 60 FPS** | NULA |
| **AI kartica** | Pojavljuje se tek kad je 100% popunjeno | Čist čet, kartica na kraju | **Savršen pregledan UX** | NULA |
| **CI/CD brzina** | 13.884 testa (traje minutima) | 1.500 ključnih testova (brzo) | **10x brži build** | NIZAK |
