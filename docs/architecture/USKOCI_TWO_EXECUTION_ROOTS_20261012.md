# USKOČI — zadaci imaju DVE glavne grane, zatim neograničenu hijerarhiju

**Potvrđen vlasnikov zahtev, 12.10.2026:** UI i poslovna klasifikacija MORAJU početi izborom:
1. **NA LOKACIJI** — izvršenje zahteva fizičko prisustvo. Tu spadaju stacionarni zadaci, prevoz od tačke do tačke, više usputnih lokacija i poslovi na području.
2. **NA DALJINU** — posao se može izvršiti bez dolaska na fizičku lokaciju.

Nijedna od dve grane nije „jedna od 11 kategorija“. Obe su **prvi, obavezni izbor načina izvršenja**, a unutar svake ide **kategorija → potkategorija → uža potkategorija → ...** bez hardkodiranog limita dubine ili broja poslova. Potkategorija je punopravni identitet usluge, a ne samo ključna reč za geografski filter.

## Primeri strukture (predlog, ne dokaz da su sve stavke na DEV-u)

- **NA LOKACIJI**
  - Kuća i majstori
    - Molerski radovi
      - Krečenje zidova
      - Gletovanje
    - Montaža nameštaja
  - Selidbe i prevoz
    - Selidbe stanova
    - Prevoz stvari
  - Čišćenje i održavanje
    - Čišćenje stanova
- **NA DALJINU**
  - Digitalne usluge
    - Grafički dizajn
      - Izrada logotipa
    - Programiranje
  - Pisanje i jezici
    - Prevođenje
    - Lektura
  - Online podučavanje
    - Online časovi matematike

**Ne kopirati na silu iste roditeljske grupe**: server može posebno autorizovati jednu kanonsku uslugu pod oba moda kroz dve veze, ali samo ako konkretno izvršenje može biti obavljeno na oba načina. Npr. čas matematike može imati lokacijski i onlajn oblik, a kućna selidba ne. Sama veza sa granom **ne znači da radnik ima potrebnu veštinu**.

## Postojeće činjenice iz kanonskog DEV-a

- `public.needs.execution_location_mode` dozvoljava `STATIONARY`, `POINT_TO_POINT`, `MULTI_STOP`, `AREA_BASED`, `REMOTE`.
- Kanonski `private.worker_need_fit_v1` je već eksplicitno `area=true` za `REMOTE`; kod `ON_SITE` primenjuje radijus ili grad kao geografski uslov.
- Novi privatni `private.work_taxonomy_categories.parent_id` već omogućava drvo neograničene dubine.
- DEV ima 11 nevezujućih legacy family ID-jeva, `auto_registration_enabled=false`; nema novih potvrđenih radničkih sposobnosti i nema task classification snapshotova.
- Current 7 old needs: 5 `STATIONARY`, 2 `POINT_TO_POINT`, 0 remote — ovo NE znači da remote treba da bude nedostupan novim korisnicima.

## Dodatak koji sprovodi vlasnikovu arhitekturu

Source-only kandidat `supabase/candidates/dynamic-taxonomy-20261011/dev-execution-scopes-two-root.sql`:
- povezuje postojećih 11 osnovnih family anchor kategorija sa `ON_SITE`, bez izmene starih task/worker podataka;
- daje stabilne nove ROOT kategorije za `REMOTE` (Digitalne usluge, Pisanje i jezici, Online podučavanje); ovo su SAMO početni folderi, ne konačan spisak usluga;
- uvodi privatnu many-to-many vezu `work_taxonomy_category_modes(category_id,execution_scope)`;
- uvodi `taxonomy_execution_scope_v1(mode)` koja mapira svih pet postojećih server modova na dva UI korena;
- uvodi paginirano `taxonomy_browse_children_v1(scope,parent_id,limit,offset)`; svako novo `parent_id` kreira sledeći nivo, a rezultat **nema authority** za objavu, aplikaciju ili push;
- granice: `service_role` može da čita, ne i da uređuje mode mapu; anon/authenticated nemaju direktan pristup; registry auto-create i dalje OFF.

**QA:** `disposable-execution-two-roots-assert.sql` i `.github/workflows/taxonomy-two-root-execution-proof.yml` verifikuju root, dubinu 2+ (ON_SITE/REMOTE), paginaciju, zabranu otvaranja parenta pogrešne grane, prava pristupa i fail-closed ponovno pokretanje migracije na PostgreSQL 16 i 17.

## Naredni slojevi, još NISU aktivirani

1. UI bira režim izvršenja u AI razgovoru ili iz korisničke namere, a zatim vodi kroz stablo; korisnik potvrđuje konačnu uslugu i da li je na lokaciji / daljinu. AI ne sme promeniti režim kad korisnik ručno odabere.
2. Fizički: obavezan odgovarajući location flow; mapa i viewport filtering samo na lokacijskim poslovima; javna približna lokacija, tačna adresa privatna do Dogovora. Prevoz koristi polazište/odredište zasebno.
3. Daljina: ne tražiti pin/radijus/lokalnu mapu; dodatni uslovi rada poput jezika i vremenskih rokova i dalje važe kada su zahtevani.
4. Worker AI profil mora imati potvrđene veštine i dozvoljene režime rada; `review ≠ save ≠ activation`. Roditeljska kategorija nikada nije blanket entitlement za sve potkategorije.
5. Dinamičke nova kategorija / AI review / task revision snapshot / worker confirmed capability tek posle pouzdanog owner-bound server gatewaya. Parent relation i sličnost sami po sebi ne aktiviraju upozorenja.
6. Pravi dispatch: eligibility = potvrđena KONKRETNA usluga + svi obavezni explicit skillovi + dozvoljeni režim + vreme + pravi geo gate (samo ON_SITE) + privacy/consent/account/block/availability/capacity + ostali postojeći hard gates. Proveriti remote/on-site pozitivne i negativne slučajeve, nikad ne odobriti na osnovu široke family label-e.
7. Povezati u jedinstevnu listu/Map i Pretragu, u AI za naručioca i AI za radnika, E2E na telefonu, kontrolisani push, isolated 30k user lifecycle benchmark, EAS preview APK i OTA.

**Važno:** odobrenje za additivni browse-only model ne znači odobrenje za silent reclassification starih user/task podataka ili uključivanje automatskog slanja. Razlike u izvornom kodu i edge/SQL runtime moraju uvek biti verifikovane.
