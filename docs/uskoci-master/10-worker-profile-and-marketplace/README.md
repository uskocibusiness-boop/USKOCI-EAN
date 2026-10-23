# 10 — Worker Profile & Marketplace Experience

## 1. Uloga Radnog profila u USKOČI

Radni profil je lična karta izvršioca u USKOČI ekosistemu. On ima dve jasno razdvojene projekcije:
1. **Vlasnički prikaz (`/profil/radnik`):** Kontrolna tabla radnika gde vidi status profila (`DRAFT`, `ACTIVE`, `PAUSED`), prekidač **„Dostupan odmah"** (`available_now`), svoje potvrđene usluge i načine rada (`Na lokaciji` / `Na daljinu` + `handoff`), područja dolaska (`workAreas`), nedeljni raspored (`/profil/dostupnost`) i ulaz u AI razgovor (`/profil/razgovor`).
2. **Javni prikaz (`/profil/[id]` — `rpc_get_public_profile`):** Ono što naručilac vidi kada radnik konkuriše na zadatak: ime, avatar, grad, kratko predstavljanje (`bio`), potvrđene veštine, broj završenih zadataka (`completedCount`), prosečnu ocenu (`ratingAverage`), pohvale i pisane komentare iz završenih Dogovora. Nikada ne otkriva privatni broj telefona, email ili kućnu adresu.

---

## 2. Šest otkrivenih problema u trenutnoj implementaciji Radnog profila i njihovo rešenje

Forenzičkom analizom fajlova `src/app/(app)/profil/radnik.tsx`, `src/app/(app)/profil/razgovor.tsx`, `src/app/(app)/profil/lokacija.tsx`, `src/ui/workerProfile/WorkerProfilePresentation.tsx` i `src/ui/workerProfile/WorkerProfileSaved.tsx` utvrđeno je sledećih 6 defekata koje treba otkloniti u prvom talasu:

1. **Ček-lista za aktivaciju (`checks`) se ne prikazuje:**
   - `radnik.tsx:318` izračunava `checks={{ basics: basicsReady, area: locationReady }}` i `readyToActivate`, ali `WorkerProfileForm` u `WorkerProfilePresentation.tsx:169` ih ne prima u argumentima već hardkoduje `<ActivationStatus status={status} readyToActivate={false} />`.
   - **Popravka:** Proslediti `checks` i `readyToActivate` kroz `WorkerProfileForm` u `ActivationStatus`.
2. **Duplirano zeleno dugme „Uredi kroz razgovor" i pogrešan natpis pri prvom ulasku:**
   - Za novog korisnika (`firstSave === true`), dugme kaže `"Uredi kroz razgovor"` umesto `"Započni kroz razgovor"`. Kada je profil `ACTIVE`, `WorkerProfileSaved.tsx:72` prikazuje zeleno dugme `"Uredi kroz razgovor"`, a čim se pojavi baner potvrde (`showFooter`), `radnik.tsx:309` prikazuje drugo identično zeleno dugme u futeru.
   - **Popravka:** Koristiti `"Započni kroz razgovor"` za novi profil i ukloniti dupliranje između tela ekrana i futera.
3. **Sakriven „Nedeljni raspored" kada je radni profil aktivan:**
   - U `WorkerProfileSaved.tsx:93`, red `"Nedeljni raspored"` ima uslov `!readOnly && !availableNow && onOpenSchedule`. Pošto `radnik.tsx:302` prosleđuje `availableNow` objekat čim je `status === 'ACTIVE'`, aktivni radnik **ne vidi red „Nedeljni raspored"**!
   - **Popravka:** Ukloniti `!availableNow` iz uslova tako da aktivni radnik uvek može da otvori i podesi svoj nedeljni raspored (`/profil/dostupnost`).
4. **Neklikabilan red „Šta radiš" (`SkillsRow`):**
   - Dok su `"Područje dolaska"` i `"Dostupnost"` u `WorkerProfileSaved.tsx` interaktivni redovi sa strelicom, `<SkillsRow />` je statičan `View`.
   - **Popravka:** Povezati `SkillsRow` sa `onEditSkills` kako bi dodir vodio u razgovor za dopunu usluga.
5. **Sakriveno dugme „Potvrdi tačku na mapi":**
   - U `WorkerProfileSaved.tsx:90`, dugme `"Potvrdi tačku na mapi"` se prikazuje samo kada je `!draft.workAreas?.length`. Ako je AI kroz razgovor već upisao grad u `workAreas`, dugme nestaje iako tačka na mapi (`approximate_lat/lng`) još nije potvrđena!
   - **Popravka:** Prikazivati dugme za potvrdu tačke na mapi sve dok `locationReady` nije zadovoljen za terenski rad.
6. **Skrivena živa kartica (`WorkerAiCard`) tokom AI razgovora (`razgovor.tsx`):**
   - `razgovor.tsx:427` prosleđuje `card={() => null}` u `AiConversationShell`, pa korisnik tokom razgovora ne vidi šta je AI upisao u nacrt sve dok ne otvori ekran pregleda.
   - **Popravka:** Prikazati kompaktnu `WorkerAiCard` karticu u `razgovor.tsx` čim nacrt ima usluge ili područje, i objediniti 5 tema razgovora u jedan čist meni.
