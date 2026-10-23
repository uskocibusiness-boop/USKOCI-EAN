# 08 — UX Architecture & User Flows

## 1. Mapa glavnih korisničkih tokova

1. **Ulaz i prijava (`Auth & Onboarding`):**
   - `EntryWelcome` → `auth.tsx` (Prijava / Registracija / Verifikacija koda) → `oporavak.tsx` (Reset lozinke) → `/(app)/home`.
2. **Tok naručioca (Objava zadatka → Izbor radnika → Dogovor → Završetak → Ocena):**
   - `Početna` ili `+ Objavi` (`/(app)/nova`) → čist AI razgovor u „ChatGPT mobilnom“ stilu (bez teškog headera, samo povratak nazad i diskretna akcija; bez kartice koja smeta dok se kuca — završna kartica izlazi na kraju) → `Pregled zadatka` (`/(app)/pregled-zadatka`) + potvrda tačke na mapi (`mesto-zadatka`) + opcione fotografije (`fotografije-zadatka`) → **Objavi zadatak**.
   - Prijem prijava → `/(app)/potrebe/[id]/kandidati` → pregled ponuda i profila kandidata → **Izaberi** (`rpc_select_response`).
   - Automatsko kreiranje **Dogovora** (`/dogovor/[id]`) → razmena poruka / svesno deljenje telefona i tačne adrese → potvrda završetka (**`Potvrdi završetak`**) → **`Oceni saradnju`** (`/oceni-dogovor`).
3. **Tok izvršioca / Uskočera (Radni profil → Pronalaženje posla → Prijava → Izvršenje → Ocena):**
   - `Profil` → `Radni profil` (`/profil/radnik`) → **Započni/Uredi kroz razgovor** (`/profil/razgovor`) → AI razgovor o uslugama, načinu rada, području i dostupnosti → `Pregled radnog profila` → **Sačuvaj profil** + potvrda tačke na mapi (`/profil/lokacija?mode=point`) → **Aktiviraj profil**.
   - Pregled zadataka na mapi/listi (`/(app)/zadaci`, filter **Za mene** ili **Svi zadaci**, pretraga po reči i gradu) ili prijem push obaveštenja `OPPORTUNITY_AVAILABLE` → `Detalj zadatka` (`/prilike/[id]`) → **Prijavi se na zadatak** (`/prilike/[id]/prijava`).
   - Po izboru od strane naručioca → radni prostor **Dogovora** (`/dogovor/[id]`) → izvršenje posla → **`Zadatak je gotov`** (`rpc_mark_work_done`) → **`Oceni saradnju`**.

---

## 2. Otkriveni UX prekidi u kodu i konkretna rešenja

| # | Tok / Ekran | Utvrđeni prekid u kodu | Rešenje za implementaciju |
|---|---|---|---|
| **1** | **Zadaci (`DiscoverySearchBar` + `DiscoverySearchPanel`)** | `DiscoverySearchPanel.tsx` (linije 289–435) ima kompletan UI za pretragu po reči i gradu (`mode === 'search'`), ali `DiscoverySearchBar.tsx` otvara samo `openPanel('filters')`, a u `filters` modu dugme za pretragu je skriveno iza `view.query.trim()`. | Povezati polje pretrage u `DiscoverySearchBar.tsx` direktno sa `openPanel('search')`, a desno dugme sa `openPanel('filters')`. |
| **2** | **AI Objava i AI Radni profil (`nova.tsx`, `IntakePresentation.tsx`, `razgovor.tsx`)** | `nova.tsx:285` prosleđuje prazno `onText: () => {}`, a klasično zaglavlje zauzima prostor iznad tastature. | Urediti oba AI ekrana u čistom „ChatGPT mobilnom“ stilu: bez teškog headera (samo čisto dugme nazad levo i diskretna akcija za novi razgovor desno), pun prostor za poruke dok razgovor traje, a završna strukturirana kartica (`DraftCard` / `WorkerAiCard`) tek na kraju kada je nacrt spreman za pregled. |
| **3** | **Pregled zadatka (`pregled-zadatka.tsx`)** | Harmonika `"Dodaj još podataka"` (linije 660–667) prikazuje 5 statičnih redova `"Nema navedenih stavki"` bez `edit` propa. | Sakriti prazne opcione redove ili klik na `"Dodaj posebne uslove kroz razgovor"` vratiti u AI razgovor sa fokusom na uslove. |
| **4** | **Radni profil (`radnik.tsx`, `WorkerProfilePresentation.tsx`, `WorkerProfileSaved.tsx`, `razgovor.tsx`)** | 1) `WorkerProfileForm` ignoriše `checks` i `readyToActivate`. 2) Duplo dugme `"Uredi kroz razgovor"`. 3) `"Nedeljni raspored"` skriven kada je profil `ACTIVE`. 4) `"Šta radiš"` nije klikabilan. 5) `"Potvrdi tačku na mapi"` skriveno kada postoji `workAreas`. | Povezati `checks`/`readyToActivate`, ukloniti duplirani CTA, uvek prikazati `"Nedeljni raspored"`, učiniti `"Šta radiš"` klikabilnim, prikazati dugme za mapu kad god tačka nije potvrđena, a u `razgovor.tsx` zadržati čist ekran bez kartice tokom kucanja i prikazati završni sažetak tek na kraju. |
| **5** | **Vlasnički pregled zadatka (`potrebe/[id]/pregled.tsx`)** | Vlasnički read ne prosleđuje `publishedAt`, pa su `"Objavljen pre..."` i R16 kartica pomoći posle 24h uvek `null`. | Uključiti `publishedAt` u vlasnički model potrebe kako bi starost oglasa i R16 pomoć radili. |
| **6** | **Izbor kandidata (`ApplicationSelectionPresentation.tsx`)** | Na liniji 157 prosleđuje se `reason={undefined}` na `<V2Action label="Izaberi" />`, pa naručilac ne vidi zašto je dugme onemogućeno. | Proslediti `reason={choice.reason}` na `V2Action`. |
| **7** | **Brisanje nacrta (`NeedLifecycleActions.tsx`)** | Traži od korisnika da prvo ručno obriše sve fotografije iz nacrta pre brisanja samog nacrta. | Dozvoliti direktno brisanje nacrta uz automatsko čišćenje draft fotografija. |
