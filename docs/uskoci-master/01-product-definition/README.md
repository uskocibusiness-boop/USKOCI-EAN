# 01 — Product Definition & Core Principles

## 1. Suština proizvoda USKOČI

**USKOČI** je dvostrana mobilna platforma za brzo, bezbedno i jasno povezivanje:
- **Naručioca** (osobe kojoj je potrebna pomoć oko konkretnog zadatka — na lokaciji ili na daljinu), i
- **Izvršioca / Uskočera** (osobe koja želi da taj zadatak obavi i zaradi).

### Zlatno pravilo naloga: Jedan čovek — jedan nalog
- Ne postoje odvojene registracije za „poslodavca" i „radnika".
- Svaki registrovani korisnik ima **jedan nalog** (`public.app_accounts`) sa dve profilne projekcije u `public.app_profiles` (`REQUESTER` i `WORKER`).
- Korisnik može odmah da objavljuje zadatke. Kada poželi da zarađuje i prima obaveštenja o poslovima za sebe, kroz AI razgovor aktivira svoj **Radni profil** (`profile_status = 'ACTIVE'`).

---

## 2. Deset kanonskih proizvodnih principa

1. **Razgovor umesto birokratskih formulara:**
   - Objavljivanje zadatka (`/(app)/nova`) i kreiranje radnog profila (`/(app)/ai-radni-profil`) vode se kroz prirodan, topao razgovor sa AI koordinatorom na srpskom jeziku (sa umerenim emotikonima 🙂).
   - Nema ručnih formulara sa 15 polja niti „olovčica" za pojedinačno uređivanje svake stavke.
   - Korisnik na kraju vidi jedan čist ekran pregleda (**Pregled zadatka** / **Pregled radnog profila**) sa dve jasne akcije: **„Izmeni kroz razgovor"** i **„Objavi zadatak" / „Sačuvaj profil"**.

2. **Dva mala Geminija u paru (Brzina + Preciznost bez čekanja):**
   - **Gemini #1 (Brzi Sagovornik):** Vodi prirodan razgovor sa korisnikom i izvlači strukturisane činjenice za ~2.5 sekunde bez blokiranja na čitanju kataloga.
   - **Gemini #2 (Pozadinski Arhitekta stabla):** Vidi **celo stablo taksonomije** u memoriji, pronalazi tačnu granu ili predlaže novu podgranu i priprema sve za objavu bez usporavanja ćaskanja.

3. **Jedinstveno značenje načina rada (`ON_SITE` vs `REMOTE` + `handoff`):**
   - **Na lokaciji (`ON_SITE`):** Izvršilac fizički dolazi na tačku, rutu ili oblast zadatka (`STATIONARY`, `POINT_TO_POINT`, `MULTI_STOP`, `AREA_BASED`).
   - **Na daljinu (`REMOTE`):** Posao se obavlja kod izvršioca ili digitalno. Ako uključuje fizički predmet (npr. poliranje dragog kamenja ili popravka pisaće mašine), definiše se **preuzimanje/slanje (`handoff`)**: kurirska služba (`shippingCountries`) ili lično preuzimanje u gradu (`localExchange`). Izrada kod izvršioca uz slanje/preuzimanje **nije** rad na adresi naručioca.

4. **Privatnost lokacije i kontakta po dizajnu:**
   - Javni zadatak prikazuje samo **okvirnu lokaciju** (`approximate_city`, `approximate_area`, zaokružene koordinate `approximate_lat/lng`).
   - Tačna adresa (`public.need_sensitive`) i broj telefona se **nikada ne dele automatski** ni pri sklapanju Dogovora.
   - Deljenje je svesna, smerna odluka u okviru Dogovora (`rpc_set_contact_grant` za `PHONE` i `EXACT_LOCATION`), sa mogućnošću opoziva budućeg pristupa.

5. **Jasna razlika između Prijave, Dogovora i Izvršenja:**
   - Prijava (`marketplace_responses`) je ponuda izvršioca (sa cenom, brojem mesta i porukom).
   - Tek kada naručilac izabere prijavu (`rpc_select_response`), nastaje obavezujući **Dogovor** (`public.agreements`) i otvara se direktan razgovor.
   - Za zadatke sa više izvršilaca (`required_slots > 1`, npr. `0/2 → 1/2 → 2/2`), automatski se otvara i **grupni razgovor** svih izabranih učesnika.

6. **Dvostrana potvrda završetka i zaštita od neaktivnosti:**
   - Izvršilac označava **`Zadatak je gotov`** (`rpc_mark_work_done`), čime stanje prelazi u `AWAITING_REQUESTER` sa rokom od **48 sati**.
   - Naručilac potvrđuje završetak (**`Potvrdi završetak`** -> `rpc_confirm_completion`), ili ako ne reaguje 48 sati niti prijavi problem (`rpc_report_problem`), sistem automatski zaključuje izvršenje (`rpc_tick_auto_completion`).

7. **Poštena reputacija bez lažne statistike zarade:**
   - Nakon završenog Dogovora, obe strane ocenjuju saradnju (1–5 zvezdica, pohvale i pisani komentar).
   - Kako aplikacija ne procesira bankovne isplate, u aplikaciji se **ne prikazuje lažna statistika „Zarađeno RSD"**, već stvaran broj završenih zadataka (`completed_count`) i prosek ocena.
