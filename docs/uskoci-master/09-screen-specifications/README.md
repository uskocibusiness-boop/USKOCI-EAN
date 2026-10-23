# 09 — Screen-by-Screen Specifications

Ovaj dokument definiše kanonsku svrhu, hijerarhiju, stanja i akcije za svaki ekran u aplikaciji USKOČI.

---

## 1. Ulaz, Prijava i Oporavak (`EntryWelcome`, `auth.tsx`, `oporavak.tsx`)
- **Svrha:** Brz, jasan ulaz u aplikaciju bez suvišnog teksta.
- **Hijerarhija:** 2.5D ilustracija (`FactArt`) → Kratak naslov (`sys.type.hero`) → Polja za unos (Email / Lozinka / OTP kod) → Primarni zeleni CTA (`V2Action` sa `brandAction`) iznad tastature.
- **Stanja:** Prazno, validacija polja na srpskom, slanje u toku (`busy`), povratak u prekinuti tok (`authFlowMemory`).

## 2. Početna (`/(app)/home` — `MarketplacePresentation.tsx`)
- **Svrha:** Komandna tabla za oba režima rada (naručilac i izvršilac).
- **Hijerarhija:**
  1. Zaglavlje sa pozdravom, zvonom obaveštenja (sa narandžastom tačkom za nepročitana) i statusom radnog profila.
  2. Dve hero akcione kartice (`HomeActionCard`): **„Objavi zadatak"** (topli narandžasti akcenat) i **„Pronađi zadatke"** (duboka zelena).
  3. **„Čeka tvoju odluku"**: Aktivni dogovori ili zadaci sa novim prijavama.
  4. **„Prilike za tebe"** (do 3 kartice sa brzim prelazom na mapu) i **„Tvoji aktivni zadaci"** (`OwnTaskCard`).

## 3. Zadaci — Mapa i Lista (`/(app)/zadaci` — `DiscoveryPresentation.tsx`)
- **Svrha:** Geografsko i tekstualno otkrivanje zadataka u realnom vremenu.
- **Hijerarhija:**
  1. **Gornja traka (`DiscoverySearchBar`):** Levi/centralni deo otvara pretragu po reči i gradu (`openPanel('search')`); desno dugme otvara filtere (`openPanel('filters')`).
  2. **Red brzih filtera (`DiscoveryChipRow`):** `Za mene` / `Svi zadaci`, način rada (`Na lokaciji` / `Na daljinu`), sortiranje i radijus.
  3. **Interaktivna mapa (`DiscoveryMap`):** Pinovi sa cenom, klasteri i plivajuća kartica izabranog pina (`DiscoveryPeek`).
  4. **Donji list (`DiscoveryListSheet`):** Lista zadataka (`TaskCard`) sa očuvanjem skrola, izabranog pina, centra/zuma mape i aktivnih filtera pri povratku iz detalja zadatka (`discoveryV1WarmReturn.ts` — 5 minuta).

## 4. AI Objava zadatka i Završni pregled (`/(app)/nova` & `/(app)/pregled-zadatka`)
- **Svrha:** Najbrži put od ideje do objavljenog zadatka kroz prirodan razgovor.
- **Hijerarhija (`nova.tsx` — čist „ChatGPT mobilni“ stil):**
  1. Minimalna gornja traka bez teškog headera: samo čisto dugme za povratak nazad levo i diskretna ikonica za novi razgovor desno.
  2. Čist, prozračan prostor poruka (`AiConversationShell`) sa toplim srpskim odgovorima Geminija #1 — **bez žive kartice koja zauzima ekran dok korisnik kuca**.
  3. **Završna kartica nacrta (`DraftCard`):** Prikazuje se tek na kraju kada AI prikupi obavezne činjenice, sa jasnim primarnim dugmetom **„Pregledaj i objavi"**.
  4. Polje za tekstualni i glasovni unos (`VoiceComposer`).
- **Hijerarhija (`pregled-zadatka.tsx`):**
  1. Kartica glavnih činjenica (Naslov, Vrsta usluge + bedž klasifikacije iz Geminija #2, Opis, Vreme, Budžet/Ponude, Broj ljudi).
  2. Ljudska potvrda lokacije na mapi (`mesto-zadatka.tsx`) za zadatke na lokaciji ili način predaje (`handoff`) za zadatke na daljinu.
  3. Opcione fotografije (`fotografije-zadatka.tsx`).
  4. Fiksni futer: Sekundarno dugme **„Izmeni kroz razgovor"** i primarno dugme **„Objavi zadatak"**.

## 5. Detalj zadatka i Prijava (`/prilike/[id]`, `/prilike/[id]/prijava`, `/potrebe/[id]/pregled`, `/potrebe/[id]/kandidati`)
- **Javni detalj (`/prilike/[id]`):** Naslov, cena/budžet, okvirna lokacija na mapi, vreme, opis, javna pitanja pre dogovora (`/pitanja-zadatka`) i primarni futer CTA **„Prijavi se na zadatak"**.
- **Ekran prijave (`/prilike/[id]/prijava`):** Izbor prihvatanja ponuđene cene ili sopstvene ponude (`OFFERS`), broj mesta (`covered_slots`), kratka poruka naručiocu i opcioni prekidač za dodavanje veštine u radni profil.
- **Vlasnički pregled i Kandidati (`/potrebe/[id]/pregled` & `kandidati`):** Pregled stanja zadatka, popunjenosti mesta (`0/2 → 1/2 → 2/2`), lista kandidata sa ocenama i ponudom, dugme **„Izaberi"** (sa jasnim `reason` objašnjenjem ako je onemogućeno) i akcije **„Izmeni kroz razgovor"**, **„Zatvori potragu"** ili **„Otkaži zadatak"**.

## 6. Dogovori, Razgovori i Ocenjivanje (`/(app)/dogovori`, `/dogovor/[id]`, `/dogovor/[id]/grupa`, `/oceni-dogovor`)
- **Lista dogovora (`dogovori.tsx`):** Segmentirani prikaz `U toku` | `Završeni` sa jasnim bedžom ko je na potezu.
- **Radni prostor dogovora (`/dogovor/[id]`):**
  - Preklopnik `Pregled` | `Poruke` u zaglavlju (bez ugnježdenog skrola četa na dnu `Pregled` taba!).
  - Na tabu `Pregled`: Ugovoreni uslovi, svesno deljenje broja telefona i tačne adrese (`AgreementContactPlace`), ulaz u grupni razgovor (`/dogovor/[id]/grupa` za zadatke sa 2+ radnika), promena uslova/otkazivanje (`/dogovor/[id]/izmene`), i primarna futer akcija (**`Zadatak je gotov`** za radnika / **`Potvrdi završetak`** za naručioca / **`Oceni saradnju`** po završetku).
  - Na tabu `Poruke`: Pun ekran razgovora (`AgreementThreadPresentation`) sa fotografijama, glasovnim porukama i brzim pregledom zadatka u zaglavlju.

## 7. Profil, Radni profil, Obaveštenja i Podešavanja (`/(app)/profil`, `/profil/radnik`, `/profil/razgovor`, `/obavestenja`, `/profil/podesavanja`)
- **Profil Hub (`profil.tsx`):** Avatar, ime, 3 pokazatelja poverenja (ocena, završeni dogovori, pouzdanost — bez lažne zarade), kartica Radnog profila sa prekidačem dostupnosti, Moje prijave, Moji zadaci i Podešavanja.
- **Radni profil (`/profil/radnik` & `/profil/razgovor`):** Ček-lista aktivacije (`ActivationStatus`), klikabilne sekcije (`Šta radiš`, `Područje dolaska`, `Dostupnost`, `Nedeljni raspored`), potvrda tačke na mapi i čist AI razgovor u „ChatGPT mobilnom“ stilu (bez teškog headera i sa završnom karticom samo na kraju razgovora).
- **Obaveštenja (`/obavestenja`):** Mirno stanje čitanja (`QuietReadState` umesto sivih skeletona), grupisana obaveštenja sa narandžastom tačkom i autoritativnim preusmeravanjem na ciljni ekran.
- **Podešavanja, Privatnost, Izvoz, Brisanje naloga i Podrška:** Ujednačeno belo platno (`SettingsScreen` + `SettingsGroup` + `SettingsRow`).
