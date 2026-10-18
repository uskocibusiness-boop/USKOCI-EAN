# USKOČI — mapa važećih izvora

Uređeno 18.10.2026. Ovo je mapa izvora, ne statusni izveštaj, novi proizvodni master ili novo ovlašćenje. Najnovija izričita odluka vlasnika ima prednost. Istorijsko odobrenje, predlog, implementacija i dokaz rada nisu ista stvar.

## 1. Aktivni ulaz

- [Počni ovde](../current/README_USKOCI_LIVE_MASTER_PLAN.md): radni prostor, izvori, način provere APK-a i održavanje plana.
- [AGENTS.md](../../AGENTS.md): poslovna pravila, privatnost, dozvole i način rada.
- [Aktuelni fizički presek](../current/CURRENT_BASELINE_20261018.md): sačuvan početak čišćenja, trenutni izvor, kandidat i instalacija.
- [redovi.json](../control/redovi.json): jedini registar 62 toka; [LIVE plan](../current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html) je njegov prikaz.
- Git, stvarni CI rezultat, konkretna instalacija i datirani DEV readback određuju stanje implementacije. Ovaj indeks nema sopstveni „trenutni LIVE broj“.

## 2. Dizajn i aktuelna odluka vlasnika

Vlasnik 18.10.2026. traži da se razdvoje sadašnja aplikacija i ostaci prethodnih verzija, te daje slobodu za organizaciju ekrana i UI/UX. [Jedini aktivan Premium White canon](../implementation/design-system/PREMIUM_WHITE_CANON.md) opisuje primenu poslednje odluke; [forenzički registar](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md) razdvaja obavezne zaštite, evoluirajuće smernice i stari freeze. `OWNER_DESIGN_DIRECTION_20260922.md`, `DESIGN_SKILLS.md`, stari icon/toolset rulebook i `product-design-truth/` sada su eksplicitno istorijske reference. [Dizajnerski ulaz](../../USKOCI_MASTER_PLAN_DIZAJNA.md) vodi na isti pravac i postojeći plan. Canon sadrži devet talasa, jedan pregled i jednu AI izmenu; petotalasni raspored je povučen. Preostali R1–R8/V28 i cloud-handoff recepti imaju fizičke history bannere. Zatvaranje dokumentacionog autoriteta je evidentirano zasebno od test/CI/native zatvaranja.

Stari SPOJ/V28/V41/V46 i druge HTML reference ostaju poreklo i pomoć u razumevanju funkcija. Ne zaključavaju raspored, broj kartica, veličinu početnih pločica ni tačno trajanje nove kompozicije. Sačuvati prepoznatljiv brend i prava na originalne resurse; promene poslovnih pravila i rezervisanih dozvola ne proizlaze iz dizajnerske slobode.

Aktivni zajednički tokeni su u `src/ui/system/tokens.ts`, geometrija rasporeda u `src/ui/system/layout.ts`. `src/ui/v2/` sadrži aktivne prezentacije; izmišljena putanja `src/ui/v2/tokens.ts` nije izvor. `scripts/sync-entry-reference-assets.cjs` sada proverava i kopira tri sačuvana resursa iz `assets/brand/reference-entry/` uz provenance manifest; stari HTML više nije postinstall ulaz niti aktuelni dizajnerski autoritet. Poreklo i bezbedan format resursa ostaju zaštićeni.

## 3. Poslovni ugovori — čitati za pogođeni domen

- [Product canon](../product-design-truth/USKOCI_PRODUCT_CANON.md), [information architecture](../product-design-truth/USKOCI_INFORMATION_ARCHITECTURE.md), [user flows](../product-design-truth/USKOCI_USER_FLOWS.md): istorijski izvor modela, uz kasnije odluke. Njihovi broj tabova, manual editori, AI format pitanja i LIVE statusi nisu aktuelni nalozi. Aktivni dizajn je Premium White; poslovni ugovor se proverava u aktuelnom kodu/serveru.
- [Final owner review 21/21](sources/owner-history/01_CURRENT_CANON/OWNER_REVIEW_21_FINAL_COMPLETE_SOURCE.md), [locked decisions](sources/owner-history/01_OWNER_LOCKS/OWNER_LOCKED_DECISIONS.md), [50-row reconciliation](sources/owner-history/02_RECONCILIATION/07_C12_SEMANTIC_DECISION_RECONCILIATION_21_21.csv): istorijsko poreklo i preživeli poslovni uslovi; kasnije odluke imaju prednost. Broj 50 označava redove odluka, ne 50 originalnih poruka.
- [RU4 parent-Need lock](../implementation/ru4/RU4_OWNER_LOCK_V1.md), [RS publication minimum](../implementation/ru3/RS_PUBLICATION_POLICY_MINIMUM_OWNER_LOCK_V1.md), [preselection Q&A](sources/owner-history/01_CURRENT_CANON/PUBLIC_PRESELECTION_QA_CONTRACT.md): ciljano za izmene, objavu i predugovorne podatke.
- [V1 plan](../implementation/product-v1-closure-20260926/PLAN.md) i [execution runbook](../implementation/product-v1-closure-20260926/FINAL_PRODUCT_EXECUTION_RUNBOOK_20260928.md): zavisnosti, cele putanje, izlazni uslovi. Njihov datirani status ne nadjačava registar i noviji dokaz.
- Više učesnika, grupni i privatni kanali, privatni uslovi, granice članstva i nezavisni životni ciklusi ostaju deo proizvoda. Bilateralni test ih ne dokazuje.

Jedan nalog ima obe namere. Poznata četiri odredišta su Početna, Zadaci, Dogovori i Poruke; ne vraćati automatski tri taba iz starog nacrta. Kategorije su interna infrastruktura; korisnik opisuje šta treba ili šta ume. Važeće poslovne i bezbednosne granice proveravaju se u kodu/SQL ugovorima, ne prepisuju iz ilustrativnog HTML-a.

## 4. Server, AI, push i pravni sadržaj

- DEV/ALPHA je `leqcwgzvjsxugfgzdmth`; [ledger](../../supabase/operations/dev-alpha/ledger/) i tačan readback dokazuju primenu. `supabase/candidates/` ne dokazuje deployment. Stari CLEAN izvori čuvaju poreklo ugovora; nisu nalog da se radi u drugom checkout-u.
- Pre izmene AI instrukcija: [audit razgovora](../implementation/v5-ai-first/ai-conversation-audit-20260922/REPORT.md), aktuelni kod obe Edge funkcije i poslednji relevantni receipt. Stara formulacija „OpenAI primary“ iz ovog indeksa povučena je kao trenutna tvrdnja; stvarni provider/model se čita iz sadašnje konfiguracije i dokaza.
- Pre medija/push-a: [preflight](../implementation/release-hardening-20260926/MEDIA_PUSH_PREFLIGHT.md) i [handoff](../implementation/release-hardening-20260926/CODEX_HANDOFF.md), uz kasnije odluke iz AGENTS. Za izvršavanje važi najnoviji nalog i aktuelni AGENTS; ranije proceduralne zabrane iz handoff-a ne vraćaju odobravanje svakog paketa. Stvarna slanja i troškovi se evidentiraju prema konkretnoj akciji.
- RC2 sadržaj je naknadno primljen prema datiranom prethodnom AGENTS zapisu (sada istorija); septembarsko „paket nedostaje“ nije sadašnji blokator. Prijem sadržaja ne dokazuje aktivaciju, pravnu spremnost ni objavu. AF-D22, tačne vezane verzije i izvršna spremnost ostaju zasebne provere.
- Tehničko poreklo: [consent](../implementation/P1_LEGAL_CONSENT_20260908.md), [D0140](../implementation/D0140A_POLICY_BUNDLE_REGISTRATION_20260908.md), [processors](../implementation/P4_PROCESSOR_MAP_20260908.md), [retention](../implementation/P3_RETENTION_SCHEDULE_20260908.md), [export](../implementation/P2_EXPORT_DELIVERY_20260910.md). To su datirani tehnički izvori, ne aktuelni pravni tekstovi niti odobrenje za purge.

## 5. Istorija i poreklo

Prethodni indeks je sačuvan [neizmenjen](history/entry-cleanup-20261018/docs/authority/AUTHORITY_INDEX.md), sa [SHA-256 manifestom](history/entry-cleanup-20261018/MANIFEST.json). Tu ostaju originalne veze ka atlasima, izvornim komandama i dokazima; čitati ih ciljano. Stari SAFE STOP, LIVE108, stare grane, GitHub blokade i „trenutni“ septembarski APK nisu aktuelna uputstva. Novija izričita odluka ili noviji fizički dokaz određuju šta važi.

`AUTHORITY_MANIFEST.json`, stare handoff datoteke i izvorni ZIP manifesti ostaju datirano poreklo. Njihov hash potvrđuje bajtove, ne odobrenje ni sadašnje stanje. Istoriju ne prepisivati da izgleda kao novo prihvatanje.
