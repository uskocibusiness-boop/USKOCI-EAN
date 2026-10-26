# USKOČI ČISTO — status, dokaz i kontinuirani plan

Presek: 26. oktobar 2026, grana `feature/uskoci-cisto`, Supabase DEV projekat `leqcwgzvjsxugfgzdmth`.

Ovaj dokument je operativni status posle rada na ČISTO grani. Priloženi forenzički plan `USKOCI_CISTO_KONACNI_PLAN_ISPRAVKI_AI_26-10-2026.md` tretiran je kao referentni nalaz i backlog, ne kao instrukcija koju treba slepo izvršiti. Nova istina je stanje koda, testova, commitova i DEV-a navedeno ispod.

## Kratak zaključak

Temelj je sada sređen u osam zatvorenih, dokazivih celina:

1. radne oblasti radnika prolaze kroz signed worker pipeline;
2. klasifikaciona pitanja imaju trajnu numeric revision zaštitu i stale fence;
3. drugi Gemini se više ne poziva kada se klasifikaciono značenje nije promenilo;
4. task i worker promptovi su skraćeni i usaglašeni na jedno kratko pitanje;
5. lokalna migraciona evidencija i stale CI očekivanje su usklađeni bez lažnog preimenovanja živog SQL-a;
6. kratki worker prompt je dobio nazad samo funkcionalno neophodna safety pravila;
7. pozadinski Gemini ima tačne telemetry oznake, pa se njegova obrada ne tumači kao čekanje glavnog razgovora;
8. buduća objava bez kanonske kategorije ima lokalni, unapred pripremljen DB gate.

Nije dirana produkcija. Nije deployovan DEV. Nije diran ugovor za `HOURLY`, jer plan pravilno zahteva odluku kako se računa konačna prijava i Dogovor. Sledeći dokazni korak je pravi DEV E2E tok sa testnim nalozima, zatim satnica tek kada se potvrdi njen proizvodni ugovor.

## Šta je urađeno i dokazano

### 1. Worker `workAreas` end-to-end

Commit: `44a2d98 Fix signed worker work areas pipeline`.

Urađeno:

- `areaRequests` se razrešava kroz postojeći server-side geocoder/resolver;
- samo service-owned tok sme da upiše kanonizovane oblasti;
- ručni/auth patch i LLM koordinate se odbijaju;
- nove sesije čitaju signed work areas i source hash;
- posle Save-a refresh se radi samo za istu signed sesiju/reviziju;
- konkurentna ili stara sesija ostaje stale;
- kompatibilne stare otvorene sesije su migrirane, a stvarno zastarela namerno ostavljena stale;
- matching scenariji: blizu Novog Sada, Beograd van zone, `COUNTRY`, `REMOTE` bez terenskih oblasti.

Promenjeni artefakti uključuju SQL migracije `20261026145430_worker_ai_signed_work_areas.sql` i `20261026150020_worker_ai_area_source_continuity.sql`, proof `worker_signed_areas_sql.test.mjs` i worker edge test.

Dokaz: ciljani server testovi 123/123, client testovi 196/196, TypeScript čist. DEV SQL i signed review provereni.

### 2. Trajna klasifikaciona pitanja i revision fence

Commit: `669df27 Fence taxonomy hints by durable revision`.

Urađeno:

- UUID više ne ide kao `draftRevision`; koristi se stvarna numeric revision;
- task koristi revision izveden iz maksimalnog message sequence-a;
- worker koristi aktuelnu durable revision;
- hint se ne čita iz druge revizije;
- pogrešna/null revision se odbija;
- upis hinta ide posle uspešnog glavnog turn-a kroz registrovani background waitUntil;
- uveden je revision-scoped consume RPC;
- stari cross-revision consume endpoint više nije javno/service-dostupan;
- testiran je exact revision store/get/consume, pogrešna revizija vraća null, cleanup radi.

DEV funkcije posle ove celine: task v148, worker v102.

Dokaz: task 71/71 i worker 118/118 u ciljanim testovima, source testovi i TypeScript čisti; DEV privilege provera potvrđena.

### 3. Klasifikacioni fingerprint i preskakanje duplog Gemini poziva

Commit: `c3b231f Skip unchanged taxonomy classifications`.

Urađeno:

- task fingerprint uključuje normalizovani service, opisani scope, `ON_SITE/REMOTE` i handoff;
- razlike u razmacima, velikim slovima i formatu ne pale novi classifier;
- promena cene, termina ili privatne adrese sama po sebi ne pali classifier;
- promena usluge, obima, načina rada ili handoff-a pali classifier;
- worker poredi punu semantičku listu skills, ne samo prisustvo `patch.skills`;
- eksplicitna promena service mode-a i dalje pali classifier;
- pending clarification hint i dalje ima prioritet i ponovo se obrađuje;
- dodati su helper/source testovi za task i worker.

DEV funkcije posle ove celine: task v149, worker v103, obe ACTIVE.

### 4. Sažet i usaglašen prompt

Commit: `c9ddc5d Condense Gemini interview instructions`.

Urađeno:

- zajednički glas više ne govori „jedno pitanje ili 2–3 nepovezana potpitanja“;
- task je zadržao sva deterministički važna pravila: RSD/EUR, datume i DST, geografiju, privatnu adresu, nacrt, pregled, Save/objavu, ljude, kategoriju i handoff;
- uklonjeni su duplikati tona, pozdrava, kalendara, krečenja i cenovnih objašnjenja;
- worker je zadržao signed Save, complete replacement `skills`, areaRequests, administrativni grad, availability/calendar i service-mode kontinuitet, ali bez ponavljanja istog pravila u više pasusa;
- uvedeni su regresioni limiti: stabilna task instrukcija <30.000 znakova, worker instrukcija <20.000 znakova;
- testne provere su prilagođene novom, kraćem tekstu, bez menjanja serverskih validacija.

DEV funkcije posle ove celine: task v151, worker v104, obe ACTIVE. Task je redeployovan još jednom posle poslednje mikro-dopune, zato v151 jeste konačna DEV verzija za ovaj commit.

### 5. Forenzički baseline, migraciona evidencija i CI očekivanje

Commitovi: `0fff6e4c` i `db0ddae6`.

- Stari welcome test je očekivao rečenicu uklonjenu namernim sažimanjem prompta; očekivanje je usklađeno sa sadašnjim UI tekstom.
- Tri postojeće AI migracije su evidentirane kao `APPLIED_RECORDED_BYTES_DIFFER`: DEV ima srodne, ali drugačije imenovane i bajt-različite zabeležene SQL zapise. Nisu proglašene bezbednim za replay.
- U `docs/ai-stabilization/` je dodat proverljiv presek: aktivni tokovi, runtime granice, agregatni DB dokazi i eksplicitna lista onoga što nije E2E dokazano.

Dokaz: fokusirani welcome test 5/5; ceo paket 621 suite / 14.131 test; migracioni integrity test 15/15.

### 6. Kratak worker prompt bez izgubljenih poslovnih pravila

Commit: `8cacf889`.

Sažimanje iz `c9ddc5d` je bilo previše agresivno: uklonilo je nekoliko stvarnih ugovora, a ne samo duplikate. Vraćena su kratka pravila za više jasnih činjenica u jednoj poruci, neizmišljanje usluga, privatnost grada/adrese, kontinuiran remote režim i istinit odgovor o Save/aktivaciji. Prompt nije vraćen u prethodni dugački oblik.

Dokaz: worker edge i policy proof 127/127.

### 7. Razdvojena latencija pozadinskog Geminija

Commit: `8967ee21`.

`NEED_BG_ARCHITECT` i `WORKER_BG_ARCHITECT` su bile aktivne putanje, ali telemetry ih je vodio kao `UNKNOWN`. Sada se pozadinskih približno 6–9 sekundi ne meša sa glavnim `NEED_COMPLETE`/`WORKER_COMPLETE` turnom. Ovo ne menja redosled poziva ni UI ponašanje.

Dokaz: relevantni AI proof paketi 261/261.

### 8. Gate za objavu bez kategorije — source-only, nije deployovan

Commit: `278aec2a`.

Read-only DEV provera je našla 8 objavljenih potreba sa `category_id` i 2 bez njega. Živa definicija `rpc_publish_need_canonical` i njen publication context nisu ni pominjali `category_id`, iako FK već postoji. Dodata je samo lokalna, append-only migracija `20261026214500_published_need_category_gate.sql`: `NOT VALID` constraint sprečava budući prelaz u `PUBLISHED` bez kategorije, a ne menja istorijske redove.

Migracija je eksplicitno označena `SOURCE_ONLY_LIVE_BINDING_UNPROVEN`. Nije izvršena, nije deployovana i ne predstavlja odluku da se istorijska dva reda automatski poprave.

Dokaz: novi regression test 1/1, migration integrity PASS (194 fajla), Python integrity test 15/15.

## Tačni push-evi

Poslednji push je:

```text
278aec2aadbf8d3e7c97d0dd6ddea41f8089795b
2026-10-26
fix(taxonomy): gate publication on canonical category
```

Prethodni push-evi ove kontinuirane serije:

```text
db0ddae6  docs(ai): record verified DEV stabilization baseline
8967ee21  fix(ai): label background classifier latency
8cacf889  fix(ai): retain concise worker interview safety rules
0fff6e4c  ci: reconcile AI migration provenance and welcome test
c3b231f  16:12:55  Skip unchanged taxonomy classifications
669df27  16:08:41  Fence taxonomy hints by durable revision
44a2d98  16:02:34  Fix signed worker work areas pipeline
```

Svi su pushovani na `origin/feature/uskoci-cisto`. Produkcija nije merge-ovana niti deployovana.

## Test status

- task stream: 71/71 PASS;
- task context/semantic suite: 145/145 PASS, 1 postojeći TODO za EUR invalidaciju;
- worker edge suite: ciljane funkcionalne provere PASS; poslednji padovi bili su samo očekivani testovi stare formulacije prompta i ažurirani su na novu formulaciju;
- worker/task TypeScript: PASS;
- workAreas server proof: 123/123 PASS;
- client worker suite: 196/196 PASS;
- fingerprint helper/source testovi: PASS;
- full istorijski source paket i dalje ima 9 ranijih, nepovezanih stale-source padova; nisu nastali ovim izmenama i ne proglašavam ih popravljеним bez posebne analize.

## Šta nije urađeno

### Satnica (`HOURLY`)

Nije menjana. Živi SQL nizvodno još mora da dobije ugovor za `submit_response`, `select_response`, candidate state, Dogovor i UI. Pre koda vlasnik mora potvrditi: da li je 1.500 RSD samo satnica ili i procena ukupne cene, kako se ponaša više radnika i da li se u prijavi šalje stopa, procenjeni sati ili oba podatka. Neću tiho pretvarati `HOURLY` u `TOTAL`.

### Pravi Gemini/DEV E2E sa testnim nalozima

Unit/proof transporti su završeni, ali prirodni jezički tok kroz pravi Gemini, signed review, Save, matching i push mora se voditi sa namenskim DEV nalozima. To je sledeći dokaz, ne nešto što treba zaključiti iz mock testa.

### Brisanje starog koda

Nema masovnog brisanja. `legacy`, `shadow`, explorer i compatibility wrapperi ostaju dok se ne dokaže koji runtime flag i APK ih zaista dostižu. Prvo se pravi matrica ACTIVE / CONDITIONAL / LEGACY_REQUIRED / TEST_ONLY / DEAD_CONFIRMED.

## Plan od sada — kontinuirani redosled

### Celina 5 — DEV E2E latency i signed tok

1. Proveriti dostupne DEV testne naloge i runtime zastavice bez ispisivanja tajni. Za sada je samo potvrđeno da su funkcije ACTIVE; tajne nisu čitane.
2. Izmeriti: claim/admission, prvi Gemini byte/TTFT, završetak glavnog Geminija, writer, SSE flush, background classifier i ukupni turn.
3. Scenario worker: Novi Sad + 30 km; Novi Sad i Beograd; dodaj gletovanje bez gubitka krečenja; REMOTE bez terenskog područja.
4. Scenario task: POINT_TO_POINT, REMOTE + handoff, fleksibilan period, EUR bez lažnog RSD, spreman zadatak bez opcionalnog pitanja.
5. Za svaki scenario proveriti: AI poruka → candidate → review → Save → signed source → matching fit → dispatch/push receipt.
6. Ako padne, popravljati prvi dokazani prekinuti link, ne ceo sistem.

Kriterijum završetka: svaki scenario ima sačuvan očekivani/izmereni rezultat, latency breakdown i nema duplog Gemini troška pri retry-u.

### Celina 6 — Ugovor za HOURLY

Tek posle potvrde vlasnika definisati DB invariant, prijavu, izbor, Dogovor, review copy, UI i regresione testove. Ako odluka nije potvrđena, uvesti bezbedan gate koji jasno kaže da satnica još nije podržana u prijavi.

### Celina 7 — Klasifikator i katalog

Dodati/zaključiti kratki `serviceMeaning` snapshot: radnja + predmet + potvrđeni scope, bez pune istorije, privatne adrese, budžeta i datuma. Unknown mode ne sme automatski postati ON_SITE. Testirati promenu usluge i stale katalog snapshot.

### Celina 8 — Razdvajanje determinističkih pravila

Prompt ostaje za ulogu, razgovor, ekstrakciju i sledeće pitanje. Validator/server ostaje autoritet za RSD/EUR, DST, geocoder/pin, revision, Save, RLS, matching i objavu. Svako pravilo koje je istovremeno u promptu i regex-u dobija jedan jasno označen autoritet.

### Celina 9 — Cleanup tek posle dokazne matrice

Za svaki legacy/shadow fajl zabeležiti ko ga poziva, pod kojim flagom, na kojoj verziji Edge-a i da li postoji aktivan test. Tek tada odlučiti KEEP / FIX / ARCHIVE / DELETE. Ništa se ne briše samo zato što u imenu ima `legacy` ili `shadow`.

## Pravilo rada za svaku sledeću celinu

Za svaku celinu radim isti krug:

1. pročitam relevantan source i živu DEV definiciju;
2. napišem mali, dokazivi patch;
3. dodam ili osvežim test koji hvata konkretan bug;
4. pokrenem ciljane testove i TypeScript;
5. deployujem samo DEV kada vlasnik to izričito odobri;
6. proverim ACTIVE verziju i, gde je moguće, live SQL stanje;
7. commitujem i pushujem na `feature/uskoci-cisto`;
8. dopunim ovaj status fajl novim commitom, rezultatima i sledećim korakom.

Ovaj fajl ne znači da je ceo plan završen; znači da je stanje merljivo i da se dalje nastavlja od Celina 5, bez vraćanja na već završene celine i bez diranja produkcije.
