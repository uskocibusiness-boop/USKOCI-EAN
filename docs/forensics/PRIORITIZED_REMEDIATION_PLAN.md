# USKOČI — PRIORITIZED REMEDIATION PLAN (Prioritizovani plan do Store-a)
**Presek stanja:** 22. oktobar 2026.  
**Cilj:** Precizan, fazni inženjerski plan za završetak aplikacije i objavu na Google Play Store-u  
**Vodeći planer:** Antigravity Lead Principal Software Architect  

---

## 1. Pregled faza do lansiranja

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FAZNI PLAN DO GOOGLE PLAY STORE-A                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ FAZA 1: Grafička optimizacija klijenta na Androidu (60 FPS, bez ANR-a)      │
│         - Uklanjanje BlurTargetView iz DiscoveryPresentation.tsx            │
│         - Zamrzavanje pointerEvents na mapi tokom prevlačenja liste         │
├─────────────────────────────────────────────────────────────────────────────┤
│ FAZA 2: Odgušivanje AI transporta (1.5s odziv, očuvana taksonomija)         │
│         - Primena DirectReply mehanizma bez multi-turn alata u toku četa    │
│         - Kartica se pojavljuje tek na kraju kada su podaci popunjeni       │
├─────────────────────────────────────────────────────────────────────────────┤
│ FAZA 3: Forward migracija za Supabase (Pravilo 30. oktobar 2026)            │
│         - Eksplicitni GRANT-ovi nad 23 bazne tabele za authenticated ulogu  │
├─────────────────────────────────────────────────────────────────────────────┤
│ FAZA 4: Potpuni End-to-End test na dva stvarna naloga                      │
│         - HONOR (Naručilac) + Emulator (Radnik) prolaze svih 20 koraka      │
│         - Objava -> Ponuda -> Izbor -> Dogovor -> Telefon -> Završi -> Ocena│
├─────────────────────────────────────────────────────────────────────────────┤
│ FAZA 5: Finalni produkcijski Release Build (.aab)                           │
│         - Hermes optimizacija, minifikacija, Play Console upload            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## FAZA 1: Grafička optimizacija klijenta na Androidu

* **Cilj:** Aplikacija na Androidu mora raditi glatko, bez seckanja i bez opasnosti od ANR-a ("Aplikacija ne reaguje").
* **Zahvaćeni fajlovi:**
  - `src/ui/v2/DiscoveryPresentation.tsx` (linije 7, 1490–1592).
* **Konkretne izmene:**
  1. Ukloniti uvoz i korišćenje `BlurTargetView` iz `expo-blur`.
  2. Zameniti ga standardnim čistim `View` elementom sa blago toniranom pozadinom (`#FFFFFF` ili `rgba(255,255,255,0.95)`).
  3. Prilikom podizanja `BottomSheet` liste zadataka (stanje `HALF` ili `FULL`), postaviti `pointerEvents="none"` na sloj mape, kako se touch gestovi ne bi sudarali sa WebView-om.
* **Kriterijum prihvatanja:** Lista zadataka se pomera glatko u 60 FPS na uređaju bez zastajkivanja.

---

## FAZA 2: Odgušivanje AI transporta uz očuvanje taksonomije

* **Cilj:** Smanjiti vreme odziva AI-ja sa 8–10 sekundi na **1.5 do 2 sekunde**, uz 100% očuvanje dinamičke taksonomije (`canonicalId`, `CREATE_CHILD`, `CREATE_NEW_BRANCH`).
* **Zahvaćeni fajlovi:**
  - `supabase/functions/uskoci-ai-interview/index.ts`.
  - `src/ui/v2/IntakePresentation.tsx`.
* **Konkretne izmene:**
  1. U `uskoci-ai-interview`, aktivirati direktni jednokratni prolaz (`canAcceptDirectClassification`). Gemini vraća tekstualnu poruku i strukturiranu klasifikaciju u istom izlazu, bez pokretanja `taxonomy_catalog` multi-turn alata tokom razgovora.
  2. U `IntakePresentation.tsx`, potvrditi da je čet potpuno čist tokom razgovora, a da se završna sažeta kartica prikazuje na dnu tek kada se prikupe svi podaci.
* **Kriterijum prihvatanja:** Korisnik unosi poruku, odgovor stiže za manje od 2 sekunde, a zadatak se uredno objavljuje sa tačnim `categoryId` u bazi.

---

## FAZA 3: Forward migracija za Supabase (Pravilo 30. oktobar 2026)

* **Cilj:** Sprečiti potencijalni prekid rada aplikacije nakon stupanja na snagu novih Supabase bezbednosnih pravila.
* **Konkretne izmene:**
  - Kreirati novu forward migraciju `20261023000000_explicit_public_table_grants.sql`.
  - Primeniti eksplicitne `GRANT SELECT, INSERT, UPDATE, DELETE` privilegije nad 23 tabele za ulogu `authenticated`.
* **Kriterijum prihvatanja:** `scripts/audit_supabase_tables.py` prijavljuje 0 tabela bez eksplicitnih dozvola.

---

## FAZA 4: Potpuni End-to-End test na dva stvarna naloga

* **Cilj:** Potvrditi u praksi da je ceo tok (Happy Path) potpuno zaokružen i spreman za stvarne korisnike.
* **Uređaji:** Naručilac (fizički HONOR telefon) + Radnik (Android Emulator).
* **Koraci provere:**
  1. Naručilac na HONOR-u kreira zadatak *"Izrada 3D figurica sa slanjem"* -> Pregleda i klikne **„Objavi zadatak“**.
  2. Radnik na Emulatoru otvara `/zadaci`, vidi zadatak i šalje prijavu sa cenom od 5.000 RSD.
  3. Naručilac na HONOR-u vidi kandidata i klikne **„Izaberi izvršioca“**.
  4. Kreira se Dogovor u `/dogovor/[id]`.
  5. Naručilac klikne **„Podeli broj telefona“** -> Radnik na Emulatoru očitava broj telefona.
  6. Radnik klikne **„Označi posao završenim“** (pokreće se 48h sat).
  7. Naručilac klikne **„Potvrdi završetak“** -> Status prelazi u `COMPLETED`.
  8. Obe strane ocenjuju saradnju sa 5 zvezdica na `/oceni-dogovor`.
* **Kriterijum prihvatanja:** Ceo ciklus prolazi bez ijednog pada, bez greške u bazi i sa obostrano upisanim ocenama.

---

## FAZA 5: Finalni produkcijski Release Build (.aab)

* **Cilj:** Generisanje potpisanog paketa za Google Play konzolu.
* **Konkretne izmene:**
  - U `app.json` definisati konačne produkcijske parametre (`version`, `versionCode`).
  - Uključiti Hermes engine i ProGuard minifikaciju.
  - Pokrenuti EAS production build:
    `eas build --platform android --profile production`.
* **Kriterijum prihvatanja:** Preuzet validan `.aab` fajl spreman za postavljanje na Google Play Console.
