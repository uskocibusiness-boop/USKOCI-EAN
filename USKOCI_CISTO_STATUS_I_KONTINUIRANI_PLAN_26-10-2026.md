# USKOČI ČISTO — objedinjeni status i nastavak MASTER plana

> **VAŽNO — ZASTAREO IZVRŠNI STATUS (26–27.10.2026).** Ovaj dokument i dalje čuva stare nalaze i njihov izvorni kontekst, ali NIJE drugi master ni trenutna komanda za posao. Posle 30.10. samo [CODEX_PLAN_RADA.md](docs/plan/CODEX_PLAN_RADA.md) (§11.2a + §12.6) vodi stvarni SOURCE/CI/DEV/NATIVE status; [Product/UX master 29.10](docs/product/USKOCI_PRODUCT_UX_MASTER.md) određuje usvojena funkcionalna/ekranska pravila. Aktivna radna grana je `work/rev14-review-f17`, ne ovde pomenuta `feature/uskoci-cisto`. Poslednji provereni pre-documentation Full CI 41130520059 i R01 41130520128 imaju FAIL. Ranije opisane „sledeće faze”, lokalni PASS i DEV stanje čitati kao istoriju i ne ponavljati završenu analizu bez konkretne nove razlike.


Ažurirano: 27.10.2026; najnoviji read-only DEV SQL dokaz prikupljen 27.10. u 04:43–04:46 UTC.
Repo: uskocibusiness-boop/USKOCI-EAN. Jedina grana rada: feature/uskoci-cisto.
Ovaj dokument zamenjuje raniji preoptimističan zaključak o „osam zatvorenih celina”.

## 0. Najnoviji nastavak — 27.10.2026

Polazni lokalni i GitHub HEAD ponovo je potvrđen kao `cb6a1fd0`, sa uspešnim CI run-om `40423068239`. Završena je sledeća mala lokalna celina, bez deploy-a ili izmene baze:

| Celina | Stvarni rezultat | Commit | Otvoreno |
| --- | --- | --- | --- |
| Pozadinski AI i potvrde upisa | Rok od 9 sekundi kreće pri pokretanju klasifikatora; neuspešan/neispravan completion ili otkazivanje prekida posao. Potvrđen uspeh nastavlja BG posle zatvaranja stream-a. Store/capture greške dobijaju fiksnu dijagnostiku bez privatnog teksta; consume prethodnog pitanja ima nezavisan ograničen signal. | `937c0780` | Trajni recovery propuštene klasifikacije, živa latencija i DEV proba. |
| Cena RSD→EUR i satnica | Dodata izvršna reprodukcija: stari potvrđeni RSD ostaje u novom pregledu posle „u evrima”; SQL HOURLY i Edge PER_HOUR guard nisu usklađeni. **Dokaz problema, ne popravka.** | `7ef48bb8` | Atomski price-correction/review/publication ugovor i potpuno očuvanje valute/satnice. |

**Provere konačnih lokalnih bajtova:**

- Novi paketi: **71/71 PASS** — 40 capture/ACK, 16 lifecycle, 5 logging i 10 currency characterization. Pre runtime izmena početni paketi imali su 28, 10 i 4 neuspeha; pozitivne kontrole su već prolazile.
- Cela AI grupa: **927 ukupno, 926 PASS, 0 FAIL, 1 raniji TODO**. TODO RSD→EUR namerno ostaje.
- Cela mobilna aplikacija: **622 paketa, 14.143 testa, 3 snapshot-a — sve PASS**.
- Dodatni CI ugovori: **55/55 PASS** (uključuje 24 PG i 31 signed/question), plus **114/114 dynamic PASS**.
- TypeScript i offline Deno 2.5.6 check tri Edge ulaza: PASS. Postojeći requester @ts-nocheck ostaje granica tipske provere.
- Migration integrity: **193 SQL fajla PASS; Python 15/15 PASS**. Nema nove migracije.

Podskupovi se preklapaju. Nezavisni reviewer nije našao blocker u lifecycle/logging patchu ni u granicama currency dokaza. Abort prekida lokalni transport; nije potvrda rollback-a već poslatog udaljenog zahteva. Zeleni characterization test ne znači da je problem cene rešen.

**Obim čitanja:** trenutni ledger obuhvata 3.434 praćena fajla: **130 FULL, 23 PARTIAL, 3.279 bez registrovanog sadržajnog pregleda i 2 izvedena inventara**. Dodati su source/test/SQL pregledi sa hash-evima, ne samo broj pokrenutih testova. FULL worker handler održan je kumulativno: ranije ceo fajl + ceo novi diff; requester ostaje PARTIAL. F0 nije zatvoren.

Detaljan jedinstveni dokaz ove celine: `docs/ai-stabilization/07_BACKGROUND_COMPLETION_AND_CURRENCY.md`. Tri prateća snapshot manifesta beleže tačan obim i SQL MD5, dok centralni manifest i ledger daju trenutno stanje. Raniji izveštaji ispod su istorijski preseci.

**Sledeće po planu:** dovršiti F0 writer/caller/provenance i neproverene CI putanje; u F1 precizno zatvoriti ugovor promene cene i očuvanja identiteta usluge. Potom najmanja dokazana SQL i durable-recovery izmena, bez preuranjene nove arhitekture. Sledeća nepovezana poruka trenutno ne ponavlja neuspešan classifier automatski — to je sada testom dokazano, ne popravljeno. Konačni kratki promptovi, telefon/E2E i p50/p95 merenje ostaju otvoreni.

Nema DEV deploy-a, produkcije, živog Gemini testa, DB upisa ili stvarnih obaveštenja. Novi GitHub CI proverava se na završnom push SHA-u; prethodni zeleni run nije dokaz za novi commit.

## 0A. Prethodni nastavak — 27.10.2026

Nastavljeno je sa potvrđenog lokalnog/remote HEAD-a `5e7790e8`; prethodni GitHub CI run `40419447597` je SUCCESS. Sledeće promene su **source-only, nisu deployovane**:

| Celina | Šta je popravljeno / dokaz | Commit | Šta ostaje otvoreno |
| --- | --- | --- | --- |
| Trajne AI potvrde i post-save transport | Store/consume zahtevaju validan ACK i tačnu reviziju pre promene keša; prekinuto telo/UTF-8 ostaju tehnička greška za postojeći retry, ne terminalni review. Lifecycle + scope 57/57 PASS. | `8f6e0627` | Durable retry nedostajućeg klasifikacionog rezultata i silent capture greške. |
| Jedno pitanje | Shadow/research uputstva i feedback daju jedno pitanje, čuvajući sve druge nejasnoće i zabranu preranog review-a. Novi testovi 6/6 PASS posle 6 početnih neuspeha. | `c74211ed` | Konačno sažimanje svih promptova, jezički kvalitet i živa latencija. |
| CI i SQL dokazi | Vraćene Deno provere tri ulaza, 7 dynamic paketa (114/114), dodata izvršna karakterizacija stvarnih SQL pisaca (18/18). | `9eced571` | Puna zamena 223 istorijska workflow-a nije dokazana; pravi PG16/17 i E2E su otvoreni. |
| Klijentska objava | Provera i potvrda objave ostaju vezane za izabranu komandu. Sačuvan legitiman canonical replay istog pregleda pod ranijim ključem; bez dodatnog RPC-a. Novi testovi 12/12 PASS. | `4efb0de3` | Stvarni telefon → DEV Save/publish tok. |

Nezavisni SQL pregled je sprečio preterano strog accept guard pre konačnog commita: prihvatanje istog pregleda sme da vrati postojeću komandu sa starijim ključem. Resume/publish imaju drugačiji, stroži ugovor. Nije uveden novi sloj ili dodatno čekanje u razgovoru.

### Završne lokalne provere ovog nastavka

- Mobilni Jest: **622/622 paketa, 14.143/14.143 testova, 3/3 snapshot-a**.
- Cela AI Node grupa: **856 ukupno; 855 PASS, 0 FAIL, 1 postojeći TODO**.
- Dodatni dynamic taxonomy paketi: **114/114 PASS**; signed/question-policy podskup: **31/31 PASS**.
- PGlite: **24/24 PASS** (18 novih characterization + 6 ranijih gate testova). Novi testovi reprodukuju postojeće ponašanje, nisu popravka baze.
- TypeScript i Deno 2.5.6 check tri Edge ulaza: PASS. Requester ima postojeći `@ts-nocheck`, pa to nije potpuna tipska provera njegovog tela ni Supabase runtime E2E.
- Migration integrity: **193 SQL fajla PASS; Python 15/15 PASS**.

Podskupovi se preklapaju. Preostali AI TODO za RSD→EUR invalidaciju nije uklonjen ni sakriven. Novi GitHub CI rezultat mora se proveriti na konačnom push SHA-u; prethodni zeleni run nije dokaz za ove izmene.

### Proširena analiza, bez tvrdnje da je sve pročitano

Tri stručna pregleda obuhvatila su klijentski tok, background lifecycle i SQL pisce. **42 izabrana živa SQL tela** pročitana su u celosti i hash-om ponovo potvrđena; to nije 42 potpuno pročitana migraciona fajla niti cela baza. Aktivni direktni writer radnikovog profila razlikovan je od signed AI Save-a. Reprodukovani su rizici teksta naspram kategorije i preimenovanja naspram povlačenja usluge, ali nije menjana šema.

Obim lokalnih fajlova vodi `01B_FILE_REVIEW_LEDGER.csv`: od 3.426 praćenih fajlova, **117 FULL, 17 PARTIAL, 3.290 još bez sadržajnog pregleda i 2 izvedena inventara**. FULL/PARTIAL zahteva hash i dokaz čitanja; brojevi uključuju source, testove, konfiguraciju i dokumentaciju, nisu broj samo runtime fajlova. Inventar i prolaz testova ne broje se kao čitanje sadržaja. F0 ostaje otvoren.

Detalji: `docs/ai-stabilization/06_CLIENT_PATH_REVIEW.md`, `06_BACKGROUND_LIFECYCLE_REVIEW.md`, `06_SQL_WRITER_REVIEW.md`, `06_SQL_WRITER_MATRIX.csv` i `06_CI_COVERAGE_REVIEW.md`.

**Sledeće po MASTER redosledu:** dovršiti writer/caller/provenance i CI pokrivenost; oblikovati F1 testni korpus i očuvanje stabilnog identiteta pri preimenovanju/povlačenju. Za background failures prvo dokazati tačan failure/unchanged-turn tok i postojeće ACK/lifecycle granice. Ne uklanjati SQL identity/consent zaštite niti uvoditi automatski retry svih pending slučajeva. DEV deploy, live upisi, Gemini/E2E merenje i obaveštenja i dalje traže posebno odobrenje.

## 1. Gde smo stvarno

Izvršene su konkretne lokalne popravke, ali **aplikacija nije proglašena završenom niti E2E potvrđenom**.
MASTER F0 je delimično urađen; postoje lokalno potvrđene P0 regresije i mali popravci iz F2/F6/F10. Nema nove arhitekture, novih SQL migracija ili masovnog brisanja.

Ovu etapu vode originalni USKOCI_ULTRA_MASTER_PLAN_2026-10-26 i izvršna komanda iz Downloads. Oba dokumenta pročitana su u celosti. Stari dodatni izveštaji navedeni u njihovom poglavlju izvora nisu svi pronađeni/pročitani i ne navode se kao novo provereni dokaz.

## 2. Šta je sada popravljeno

### A. Povučena pogrešna zabrana objave — commit 46ab53e5

Prethodni 278aec2a je dodao neprimenjenu CHECK NOT VALID zabranu PUBLISHED zadatka bez category_id.
To nije bilo usklađeno sa MASTER F5.3: objava može postojati dok automatsko povezivanje čeka potvrdu usluge. Izvršni PostgreSQL test pokazao je i da zabrana blokira običnu izmenu naslova starog objavljenog zadatka.

- Kandidat uklonjen samo iz aktivnog migracionog spiska i sačuvan identičan pod docs/ai-stabilization/rejected/.
- DEV provera potvrđuje da constraint nikada nije bio postavljen; baza nije menjana.
- Sačuvani postojeći FK i strict scope matching; kategorički ID sam nije dovoljan bez potpisane aktuelne revizije i saglasnosti radnika.
- PGlite je dodat samo kao pinovana dev/test zavisnost, ne runtime aplikacije.
- Dokaz: 6/6 izvršnih PG testova; 15/15 migration integrity testova; integrity PASS za 193 SQL fajla.
- Granica: minimalne fixture tabele i PG18.3; nije puna DEV PG17 publish/binder/dispatch proba.

### B. Razgovor i klasifikator — commit d2290292, nije deployovano

- **S09:** 429/503, abort, neispravan/nepotpun JSON, prekid zbog token limita i provider refusal više ne postaju lažno pitanje korisniku. Razlikuju se tehnički statusi; prava semantička nejasnoća i dalje može dati jedno pitanje.
- **S10:** radnik ne dobija ON_SITE iz kataloga ili područja rada. Čuvaju se njegovi saved izbori i handoff; nova promena zahteva postojeći USER-quote ugovor i validan rezultat, pa tek onda signed review/Save.
- Promena samo načina rada ili predaje sada pokreće dual klasifikator. Nevalidni/stari citati i BLOCK/REVIEW ne pokreću nepotrebni posao.
- Greška modela ne sme proširiti mode čak ni kada katalog podržava novi mode. Nepromenjeni sačuvani izbor opstaje.
- Biografija je opciona; nema obaveznog dodatnog razgovora i zasebne potvrde pre završnog review-a.
- Oba direktna streaming razgovora imaju PROVIDER merenje success/failure bez sadržaja poruka.
- Signed Save, owner/revision fence, geocoder/workAreas, potpuna skills lista i bezbednosna validacija ostali su postojeći autoriteti.
- Tehnički failure statusi JESU dijagnostika, ali NISU trajni retry mehanizam.

Status: CODE_CHANGED_NOT_E2E. Ceo AI paket je ponovo izvršen i posle poslednje dopune 147950a3: 808 PASS, 0 FAIL, 1 postojeći TODO.

### C. Forenzički pregled i istinitija evidencija

- GitHub početni HEAD ponovo potvrđen kao 70ac69c3; lokalna grana nije bila iza remote-a.
- PR #40/#41/#42 su OPEN; nisu spojeni. Razlika prema unified-qa-master pokazuje 223 uklonjena istorijska workflow-a i jedan novi ci-clean. To nije automatski dokaz da sve stare CI provere imaju zamenu; pokrivenost treba zasebno mapirati.
- Devet OPEN pending slučajeva razdvojeno je na **3 STALE_REPLACED** i **6 UNDETERMINED**. Tri stara worker pregleda već imaju noviji Save istog profila. Nema masovnog retry-a ili promene statusa.
- Svaki praćeni fajl dobija hash/tip/status u FILE_REVIEW_LEDGER-u. Automatski popis nije „pročitao sam sve”; nepregledani fajlovi su jasno označeni.
- Statički import/RPC graf polazi od šest aktivnih ulaza; nije kompletan runtime/SQL/trigger graf.

### D. Testna infrastruktura — commit 33b1a50f

Obnovljene su reference QA testova na jedini postojeći policy izvor u migraciji, ne stari direktorijum dokumenata. Helper proverava kompletan hash 4.771-bajtnog originala i identičan neaktivirani renderer. Cela AI offline grupa i dodatne regresije uključene su u ci-clean.yml. Nije pokrenut nijedan disposable SQL proof protiv DEV-a.

Novi kodni commitovi ove etape: 46ab53e5, d2290292, 33b1a50f. Dokumentacioni commit čuva ovaj presek i manifest. Stanje remote-a proverava se posle push-a; ovaj tekst sam po sebi nije potvrda GitHub CI uspeha.

### E. Čuvanje klasifikacionog pitanja — commit 147950a3

Završna read-only provera aktuelnog DEV RPC-a otkrila je još jedan neusaglašen ugovor: modelov razlog mogao je imati 900 znakova, a SQL dopušta 300. Razlog i pitanje sada se ograničavaju bez presecanja Unicode codepoint-a, uz isti normalizovan tekst za RPC i lokalni keš. NULL mode/reason i revision zaštita ostaju nepromenjeni; odbijen SQL ne puni keš. Devet novih scenarija palo je pre ispravke, a ciljani paket sada prolazi 19/19.

DEV worker context oblik i nullable clarification mode potvrđeni su čitanjem aktivnih definicija, bez otvaranja sesije. To nije E2E poziv. GitHub CI za prethodni dokumentovani SHA 881c6e94 prošao je: run 40418294231. Kasnija dopuna 147950a3 ima ponovo izvršenu kompletnu lokalnu AI grupu; CI rezultat završnog SHA proverava se zasebno.

## 3. Važne ispravke ranijih tvrdnji

**120–329 ms nije brzina Geminija.** NEED_COMPLETE/WORKER_COMPLETE meri samo writer RPC. Ukupna latencija do odgovora na telefonu još nije izmerena ovom etapom. Pozadinskih približno 6–9 sekundi takođe nije glavni odgovor.

Promptovi nisu završno sažeti. Sintetički izmereno stabilno uputstvo: NEED 26.819 znakova, WORKER 19.759; istorija i dinamički podaci dolaze dodatno. Nema eksplicitnog cachedContent u pregledanim zahtevima. Ne postoji dokaz garantovanog cache hit-a ili 75% uštede.

Semantičko povezivanje različitih naziva iste usluge i dalje nije završeno: S07/S08 traže zajednički ugovor i SQL admission. Ne sme se samo izbrisati identity guard.

## 4. Testovi prethodnog preseka — pre nastavka iz odeljka 0

- Cela mobilna aplikacija: **621/621 paketa, 14.131/14.131 testova, 3/3 snapshot-a**.
- TypeScript npx tsc --noEmit: PASS nakon ažuriranja mode deklaracija.
- Sedam povezanih Edge/mode/handoff/policy paketa: 393 slučaja, **392 PASS, 0 FAIL, 1 postojeći TODO**.
- BG failure/scope regresije: prethodno **50/50 PASS**; naknadni scope paket proširen je sa 7 na **19/19 PASS**.
- CI taxonomy/signed-review/publication podskup: **37/37 PASS**, uključujući šest PG testova.
- Migration integrity: **193 SQL fajla PASS; 15/15 Python testova**.
- Svi AI proof fajlovi posle poslednje dopune: **809 ukupno, 808 PASS, 0 FAIL, 1 postojeći TODO**. Stari fingerprint source regex je usklađen sa jačom USER-quote proverom. QA policy se čita iz postojeće migracije uz proveru identičnog kompletnog istorijskog hash-a; stare arhive nisu vraćene.
- QA activation/fixture podskup: **15/15 PASS**. Tri disposable skripte su proverene sintaksno, nisu izvršavale SQL.
- CI sada pokreće celu AI offline grupu, novu PG regresiju i Python integrity unit testove. GitHub rezultat novog SHA se ne podrazumeva iz lokalnih testova.

Brojevi podskupova se preklapaju i ne sabiraju se u jedinstven broj testova.
Postojeći TODO: aktivni RSD fact zahteva atomsku writer/review invalidaciju pri ispravci na EUR.

Nisu izvršeni pravi Gemini pozivi, telefonski tok, DEV deploy, matching/dispatch/push ili E2E sa test nalozima.

## 5. Raniji rad koji se čuva

| Commit | Ranije uvedena funkcionalnost |
| --- | --- |
| 44a2d98 | Signed worker workAreas + server geocoder i Save kontinuitet |
| 669df27 | Trajna numeric revision zaštita klasifikacionih pitanja |
| c3b231f | Fingerprint i preskakanje nepromenjene klasifikacije |
| c9ddc5d | Ranije sažimanje oba prompta i jedno pitanje |
| 0fff6e4c | Migraciona provenance evidencija i welcome očekivanje |
| 8cacf889 | Vraćena neophodna sažeta worker pravila |
| 8967ee21 | Ispravne oznake BG faza; ne merenje celog razgovora |
| db0ddae6 / 70ac69c3 | Početni baseline/status, sada korigovani |
| 278aec2a | Pogrešan source-only gate; POVUČEN commitom 46ab53e5 |

Ranije zabeleženi DEV task v151 / worker v104 / post-save v5 nisu verzije novih lokalnih popravki. U ovom odobrenom radu ništa nije deployovano niti dirana produkcija.

## 6. Šta dalje, redosledom MASTER plana

1. **Dovršiti F0:** potpuna matrica aktivnih pisaca/poziva/privilegija i CI pokrivenosti; razjasniti šest UNDETERMINED slučajeva i audit porekla null kategorija. Nastaviti stvarno čitanje preostalog source/SQL/config/test sadržaja.
2. **F0 baseline E2E — posebno odobrenje:** namenska DEV dva naloga, ograničen budžet i izolovane potrebe/profili, bez stvarnih obaveštenja. Tačno meriti prvi prekinuti link, provider/writer/Save/classification/matching. DEV deploy traži zasebno izričito odobrenje.
3. **F1 ugovor i golden corpus:** service intent/decision/result, stabilan serviceInstanceKey, scope/revision/digest/catalog i 70 jezičkih +30 failure/race slučajeva. Čuvati postojeće signed digest-e.
4. **F2/S07:** shared semantički classifier u režimu bez upisa; REUSE/EXTEND sa stvarnim UUID-jem i proverenim katalogom, ne dupliranje kategorije jer se naziv razlikuje.
5. **F3/S08:** SQL admission uz najmanje postojeće owner/source/risk/mode/consent/idempotency zaštite; zatim trigger/binder i worker retain/revoke. Bez novih migracija dok F0 gate nije zatvoren.
6. **F4/S06:** trajni bounded recovery za dokazano tehničke greške, postojeći outbox, lease/backoff/cost cap/stale fence; nikada svih devet pending naslepo.
7. **F5:** dokaz review→Save→objava→matching→dispatch, zatim odobreni test-phone push→prijava→Dogovor. Null/pending nema automatsku matching dozvolu.
8. **F6/F10:** finalno kratka uputstva bez dupliranja server pravila, kompaktan klasifikacioni snapshot, A/B jezički kvalitet i stvarna p50/p95 latencija/cache/tokeni.
9. **F7:** svi primarni ekrani, navigacija, loading/empty/error/offline/accessibility i Android dokaz. Ne označavati frontend završenim na osnovu backend testova.
10. **F8:** poslovni ugovor za HOURLY, cenu, broj radnika, prijavu i Dogovor; EUR bez skrivene konverzije. Te odluke nisu pretpostavljene.
11. **F9/F11/F12:** čišćenje samo DEAD_CONFIRMED sadržaja, sigurnosne i operativne provere, release/build/Play/sajt posle prethodnih gate-ova.

## 7. Dozvole i način rada

Dozvoljene su male lokalne izmene, read-only DEV/GitHub, offline testovi i commit/push ČISTO grane.
Bez posebne dozvole nema DEV deploy-a, produkcije, destruktivnih migracija, stvarnih obaveštenja ili automatskog popravljanja podataka.

Svaka celina: reprodukcija → mali patch → negativni i pozitivni test → nezavisni pregled → commit → push → dokaz/otvorene granice.
Prolaz testa sa stubom nije tvrdnja da pravi provider, baza i telefon rade zajedno.

## 8. Dokazi u repozitorijumu

- docs/ai-stabilization/00_BASELINE_STATE.md — početno stanje i granice F0.
- docs/ai-stabilization/01B_FILE_REVIEW_LEDGER.csv — popis fajlova, hash i tačan status čitanja.
- docs/ai-stabilization/01_DEPENDENCY_GRAPH.csv — statički import/RPC graf.
- docs/ai-stabilization/02_RUNTIME_FLAGS.md — stvarno značenje vremena i veličina zahteva.
- docs/ai-stabilization/03_DB_EVIDENCE.md — read-only DB dokazi i povučeni gate.
- docs/ai-stabilization/04_FAILING_E2E_CASES.md — regresije i šta nije E2E.
- docs/ai-stabilization/05_PENDING_FORENSIC_LEDGER.csv i 05_PENDING_READONLY.sql — devet slučajeva i reproduktivni SELECT upiti.

Ovaj fajl je jedinstvena operativna polazna tačka; nije potvrda da je ceo MASTER završen.
