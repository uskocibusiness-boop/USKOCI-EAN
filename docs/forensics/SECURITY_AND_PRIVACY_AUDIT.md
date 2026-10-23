# USKOČI — SECURITY & PRIVACY AUDIT (Bezbednost i privatnost)
**Presek stanja:** 22. oktobar 2026.  
**Klasifikacija:** Interna forenzička bezbednosna revizija  
**Forenzički auditor:** Agent 08 — Security and Privacy Auditor  

---

## 1. Zaštita tajni i API ključeva (Secrets Handling)

* **VERIFIED — Provajderski ključevi su izolovani na serveru:**  
  Kritični servisi poput `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` i privatnih sertifikata **ne nalaze se u klijentskom React Native kodu**, niti u Expo bundle-u.
  Svi pozivi ka Google Gemini API-ju i administrativnim operacijama izvršavaju se isključivo unutar Supabase Edge Funkcija (`uskoci-ai-interview`, `uskoci-worker-interview`, `uskoci-push-transport`).
* Klijentska aplikacija poseduje isključivo javni `EXPO_PUBLIC_SUPABASE_ANON_KEY` i `EXPO_PUBLIC_SUPABASE_URL`, što je standardna i preporučena Supabase arhitektura.

---

## 2. Row Level Security (RLS) i izolacija korisničkih podataka

* **100% tabela sa ličnim podacima ima uključen RLS:**  
  Tabele `public.needs`, `public.need_sensitive`, `public.marketplace_responses`, `public.agreements`, `public.agreement_messages`, `public.access_grants`, `public.ai_conversations`, `public.app_profiles` imaju striktne RLS polise.
* **Javne projekcije ne otkrivaju privatne podatke:**
  - Neprijavljeni korisnici i radnici koji pregledaju zadatak na mapi vide samo približnu lokaciju (grad ili kvart).
  - Tačne GPS koordinate, kućni broj, sprat i napomene za ulaz (`need_sensitive`) su zaštićeni i nedostupni dok naručilac ne izabere radnika i ne odobri deljenje.

---

## 3. Autoritativni sistem deljenja kontakata (`access_grants`)

USKOČI ne koristi naivni boolean `is_phone_visible = true`. Implementiran je rigorozan sistem prava pristupa:
1. **Zabrana automatskog deljenja:** Sklapanje dogovora ne znači automatsko deljenje broja telefona.
2. **Eksplicitna saglasnost:** Broj telefona se otkriva tek kada korisnik klikne „Podeli broj telefona“, što poziva:
   `rpc_set_contact_grant(agreement_id, grant_type, target_account_id)`
3. **Zaštićeni čitač:** Druga strana broj dobija preko `rpc_reveal_contact(agreement_id, grant_type)` samo ako poseduje validnu, neopozvanu dozvolu.
4. **Mogućnost opoziva:** Korisnik u svakom trenutku može opozvati budući pristup preko `rpc_revoke_contact_grant`.

---

## 4. Pravo na brisanje naloga i zaborav (Google Play / Apple uslov)

Za izlazak na Google Play Store i Apple App Store obavezno je postojanje mehanizma za brisanje naloga unutar same aplikacije:
* **UI ulaz:** Ekran `src/app/(app)/profil/podesavanja.tsx` sadrži opciju za zatvaranje naloga.
* **Serverski mehanizam:**  
  Procedura `rpc_prepare_account_closure` i Edge worker `uskoci-account-closure-worker` realizuju brisanje sesija, redakciju ličnih podataka u porukama i brisanje istorije razgovora.
* **Migracija `20261021104455_closure_taxonomy_archive_copy_coverage`:**  
  Ova migracija je primenjena na DEV-u i pokriva redakciju ličnih podataka čak i u arhivskim zapisima taksonomije, čime je sprečeno zaostajanje tragova korisničkog identiteta.

---

## 5. Mediji, fotografije i skladištenje

* **Zaštita slika zadataka:**  
  Edge funkcija `uskoci-media` (v22) vrši proveru mime-type-a, ograničava veličinu i briše EXIF metapodatke (geografske podatke kamere) pre nego što se fotografija smesti u Supabase Storage, čime se sprečava nehotično odavanje lokacije korisnika.

---

## 6. Rezime bezbednosnog preseka

| Oblast | Nivo rizika | Status | Napomena |
| :--- | :--- | :--- | :--- |
| **Izolacija Gemini i DB ključeva** | NIZAK | **ODLIČNO** | Ključevi su samo na Edge funkcijama |
| **RLS zaštita privatnih podataka** | NIZAK | **ODLIČNO** | Polise onemogućavaju neovlašćen SELECT |
| **Zaštita broja telefona** | NIZAK | **ODLIČNO** | Pokriveno kroz `access_grants` |
| **Brisanje naloga (Store uslov)** | SREDNJI | **SPREMNO** | Potrebno samo završno dvonaložno testiranje |
| **Oct 30 Explicit Table Grants** | SREDNJI | **POTREBNA MIGRACIJA** | Dodati eksplicitne GRANT-ove na 23 tabele |
