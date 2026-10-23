# 16 — Testing, QA & E2E Verification Strategy

## 1. Pet nivoa verifikacije u USKOČI

| Nivo | Obim i alati | Broj postojećih testova | Šta dokazuje |
|---|---|---|---|
| **Nivo 1: Klijentski Unit, Component & Contract testovi** | `npm test` (Jest + `react-test-renderer`) nad `src/**/__tests__` | **620** test fajlova | Ispravnost dekodera potvrda (`readOwnedResult`), lokalnih dnevnika komandi (`AsyncStorage` journals), fokus/AppState ograda i UI stanja ekrana. |
| **Nivo 2: Edge & Taksonomski Node testovi** | `node --test supabase/proofs/ai/*.test.mjs supabase/proofs/dynamic_taxonomy/*.test.mjs` | **29+** test fajlova (**215/215 prolazi**) | Sigurnost Edge hendlera (`uskoci-ai-interview`, `uskoci-worker-interview`), autorizacija, budžet, Dual-Gemini arhitektura i pravila klasifikacije. |
| **Nivo 3: Lokalni PostgreSQL & PostgREST dokazi** | `supabase/proofs/**/*.{mjs,sql}` | **817** fajlova u 56 oblasti | RLS politike, kolonske privilegije, konkurentno zaključavanje redova (`FOR UPDATE`), atomarnost prijava, izbora, završetka i ocenjivanja. |
| **Nivo 4: Živi DEV Backend & Gemini E2E testovi** | `scripts/benchmark_full_drago_kamenje.mjs`, `scripts/acceptance/dev_ai_acceptance.mjs`, `dev_taxonomy_fulltree_acceptance.mjs` | **8+** skripti | Stvarna brzina i tačnost odgovora na `leqcwgzvjsxugfgzdmth` sa pravim Gemini pozivima i stvarnim upisom u bazu. |
| **Nivo 5: Fizički Android uređaj (HONOR) i Emulator UI E2E** | `scripts/acceptance/device_acceptance.py`, `scripts/ru5_android_device_ui_journey.py`, `adb` + `uiautomator` | **12+** Python skripti | Stvarno ponašanje instaliranog APK-a na telefonu, dodiri, tastatura, deep-linkovi i dvostrani korisnički tokovi (Naručilac + Izvršilac). |

---

## 2. Obavezni E2E scenariji pre svakog javnog izdanja

1. **Scenario A (Novi zadatak kroz Dual-Gemini):** Korisnik u `/(app)/nova` opiše zadatak u 2–3 poruke (svaki odgovor ~2.5–3.5s), vidi živu karticu tokom razgovora, otvori `Pregled zadatka` (`classificationState: 'READY'`), potvrdi pin na mapi i objavi zadatak.
2. **Scenario B (Radni profil kroz Dual-Gemini):** Korisnik u `/profil/razgovor` navede čime se bavi, gde radi i kada je dostupan, vidi živu karticu, sačuva pregled, potvrdi tačku na mapi i aktivira profil (`/profil/radnik`).
3. **Scenario C (Pretraga i prijava na zadatak):** Izvršilac na ekranu `Zadaci` pretraži zadatak po reči/gradu ili filtrira `Za mene`, otvori detalj, vrati se nazad (mapa, pin, filteri i skrol ostaju sačuvani), a zatim podnese prijavu (`/prilike/[id]/prijava`).
4. **Scenario D (Izbor kandidata, Dogovor, Chat i Svesno deljenje):** Naručilac u `/potrebe/[id]/kandidati` izabere radnika (`0/1 → 1/1` ili `0/2 → 1/2`), otvori se Dogovor (`/dogovor/[id]`), razmene poruku/sliku, naručilac svesno podeli tačnu lokaciju, a radnik je otkrije.
5. **Scenario E (Završetak i Dvostrana ocena):** Radnik označi `Zadatak je gotov`, naručilac klikne `Potvrdi završetak`, i obe strane ocene saradnju na `/oceni-dogovor`.
