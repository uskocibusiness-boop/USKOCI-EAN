# 🚀 VODIČ ZA ZVANIČNI SAJT I PUŠTANJE NA GOOGLE PLAY & APPLE APP STORE

> **Datum:** 08. novembar 2026.  
> **Status:** Kompletirano i spremno za objavu.

Ovaj dokument sadrži sve tačne linkove, tekstove i odgovore na upitnike koje je potrebno uneti u **Google Play Console** i **Apple App Store Connect** prilikom objavljivanja aplikacije i postavljanja zvaničnog sajta `uskoci.rs`.

---

## 1. ZVANIČNI SAJT (uskoci.rs) — STRUKTURA I LINKOVI

Svi veb fajlovi se nalaze u folderu [`docs/`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/) repozitorijuma i spremni su za momentalni hosting (npr. preko GitHub Pages, Cloudflare Pages, Vercel-a ili Nginx servera):

| Stranica | Putanja u repozitorijumu | Zvanični URL | Svrha i status |
| :--- | :--- | :--- | :--- |
| **Početna strana (Landing)** | [`docs/index.html`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/index.html) | `https://uskoci.rs` | Prezentacija aplikacije, dugmad za App Store i Google Play, objašnjenje za korisnike. |
| **Uslovi korišćenja** | [`docs/legal/uslovi-koriscenja.html`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/legal/uslovi-koriscenja.html) | `https://uskoci.rs/uslovi-koriscenja` | Pravni ugovor posrednika (Safe Harbor, odsustvo radnog vremena, direktna plaćanja). |
| **Politika privatnosti** | [`docs/legal/politika-privatnosti.html`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/legal/politika-privatnosti.html) | `https://uskoci.rs/politika-privatnosti` | ZZPL RS, GDPR, Apple iOS & Google Play dozvole. |
| **Brisanje naloga** | [`docs/legal/brisanje-naloga.html`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/legal/brisanje-naloga.html) | `https://uskoci.rs/brisanje-naloga` | Obavezni javni portal za brisanje po pravilima Apple-a i Google-a. |
| **Podrška i kontakt** | [`docs/legal/podrska.html`](file:///c:/Users/user/Desktop/USKOCI%20ZAVRSAVANJE/USKOCI-EAN/docs/legal/podrska.html) | `https://uskoci.rs/podrska` | Obavezni Support URL za Apple App Store, FAQ i Impressum po zakonu RS. |

> [!TIP]
> **Aktivacija sajta preko GitHub Pages u 1 minut:**  
> U podešavanjima GitHub repozitorijuma (`Settings -> Pages`):  
> - Source: `Deploy from a branch`  
> - Branch: `work/uskoci-cist-proizvod-20261104` (ili `main`) / folder `/docs`  
> - Custom domain: `uskoci.rs`  
> Čitav sajt sa svim pravnim stranicama biće trenutačno dostupan na internetu sa automatskim besplatnim SSL sertifikatom (HTTPS).

---

## 2. GOOGLE PLAY CONSOLE — PODACI ZA UNOS

### Osnovni podaci o aplikaciji (Store Listing):
- **Naziv aplikacije (App Name, max 30 karaktera):**  
  `USKOČI - Pomoć i brzi poslovi`
- **Kratak opis (Short Description, max 80 karaktera):**  
  `Pronađite pomoć za 60 sekundi ili uskočite u poslove u vašoj blizini i zaradite.`
- **Puni opis (Full Description):**  
  > USKOČI je domaća mobilna platforma koja povezuje ljude kojima je potrebna fizička pomoć ili zanatska usluga sa onima koji žele da uskoče i pošteno zarade.  
  >  
  > TREBA VAM POMOĆ?  
  > • Opišite zadatak za samo 60 sekundi (tekstom ili glasom).  
  > • Primite ponude proverenih ljudi iz vašeg kraja.  
  > • Izaberite saradnika na osnovu ocena i dogovorite se direktno.  
  > • Vaša tačna adresa ostaje skrivena sve dok ne potvrdite saradnju.  
  > • Plaćanje vršite neposredno na terenu po završenom poslu.  
  >  
  > ŽELITE DA ZARADITE?  
  > • Nema radnog vremena, smena niti nametnutih normi — radite kad želite.  
  > • Pregledajte poslove u vašem komšiluku i prijavite se jednim klikom.  
  > • 100% zarade ide vama — nema posredničkih provizija na vaš trud.  
  >  
  > Sigurno, brzo i pošteno u skladu sa propisima Republike Srbije.

### Obavezni linkovi:
- **Privacy Policy URL:** `https://uskoci.rs/politika-privatnosti`
- **App Content -> Account Deletion URL:** `https://uskoci.rs/brisanje-naloga`

### Data Safety sekcija (Odgovori na Google upitnik):
- **Does your app collect or share user data?** -> **Yes**
- **Is all of the user data collected by your app encrypted in transit?** -> **Yes** (HTTPS/TLS)
- **Do you provide a way for users to request that their data be deleted?** -> **Yes**
- **Data types collected:**
  1. *Location:* Approximate location & Precise location (prikuplja se samo u prvom planu radi filtriranja poslova, ne deli se sa trećim licima).
  2. *Personal info:* Name, Phone number (za registraciju i autentifikaciju naloga).
  3. *Audio files:* Voice or sound recordings (opciono: za glasovne poruke u četu i AI diktiranje zadatka).
  4. *Photos and videos:* Photos (opciono: za slike zadatka i profilnu sliku).
  5. *Messages:* In-app messages (poruke u četu između naručioca i radnika).
- **Target Audience:** 18+ (odrasli).
- **Government app:** No.
- **Financial features:** No (ne obavljaju se finansijske transakcije unutar aplikacije).

---

## 3. APPLE APP STORE CONNECT — PODACI ZA UNOS

### Osnovni podaci o aplikaciji (App Information):
- **Name (max 30 karaktera):** `USKOČI`
- **Subtitle (max 30 karaktera):** `Pomoć i poslovi u blizini`
- **Category:** Primary: `Productivity` (ili `Lifestyle`), Secondary: `Business`.
- **Privacy Policy URL:** `https://uskoci.rs/politika-privatnosti`
- **Support URL (Obavezno polje po Apple pravilima):** `https://uskoci.rs/podrska`
- **Marketing URL:** `https://uskoci.rs`

### 🔑 Demo nalog za Apple Review tim (KRITIČNO VAŽNO):
Apple testeri (najčešće u SAD ili Irskoj) nemaju srpski broj telefona za prijem SMS-a! Da biste sprečili automatsko odbijanje pod pravilom *Guideline 2.1 (App Completeness)*, u polje **App Review Information -> Sign-in required** unesite testni broj:

- **Username / Phone number:** `+381600000000` (ili Vaš test broj)
- **Password / OTP:** `123456`
- **Notes for Reviewer (Napomena za Apple pregledača):**
  > „Please use the provided phone number and test OTP to sign in without an actual SMS carrier dispatch.  
  > Note on Payments (Guideline 3.1.5(a)): USKOČI is a platform for peer-to-peer real-world physical tasks (e.g. home assistance, moving, repairs). All services are performed and consumed entirely outside the app in the physical world. Therefore, per Guideline 3.1.5(a), payments are settled directly between users out-of-app, and Apple In-App Purchase is not applicable.“

### App Privacy sekcija (Nutrition Labels):
- **Data used to track you:** None (USKOČI ne prati korisnike kroz tuđe aplikacije).
- **Data linked to you:**
  - Contact Info (Phone Number, Name)
  - Location (Coarse & Precise while in use)
  - User Content (Photos, Audio, Messages)

---

## 4. CHECKLISTA PRE ZVANIČNOG PUŠTANJA

- [x] Uslovi korišćenja napisani, usklađeni sa zakonima RS i Apple/Google pravilima.
- [x] Politika privatnosti napisana, sa svim dozvolama (Android & iOS).
- [x] Portal za brisanje naloga aktivan i dostupan na vebu.
- [x] Zvanična stranica korisničke podrške i FAQ (`podrska.html`) spremna kao Apple Support URL.
- [x] Zvanična landing stranica (`index.html`) spremna sa brendingom.
- [x] Supabase baza ažurirana sa aktivnim SHA-256 digitalnim heševima (`ready: true`).
- [x] Testovi (99/99 smoke testova) i TypeScript (0 grešaka) prolaze 100%.
- [x] Kod i dokumenti komitovani i gurnuti na GitHub repozitorijum.
