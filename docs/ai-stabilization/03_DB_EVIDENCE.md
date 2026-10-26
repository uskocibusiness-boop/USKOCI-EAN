# DEV SQL dokazi — read-only

DEV leqcwgzvjsxugfgzdmth, 26.10.2026 UTC. Beleže se agregati i pseudonimizovani case ID-jevi, ne poruke, identiteti, adrese ili koordinate.

## Katalog / objava

Ranije potvrđeno: 153 ESTABLISHED kategorije; PUBLISHED potrebe: 8 sa category_id, 2 bez. Null nije sam po sebi dokaz korupcije niti porekla iz aktuelnog AI-a. MASTER F5.3 dopušta objavu dok automatsko povezivanje čeka potvrdu usluge.

Kandidat 20261026214500_published_need_category_gate.sql iz 278aec2a bio je pogrešan: NOT VALID CHECK proverava i budući UPDATE starog reda, pa blokira čak i ispravku naslova postojećeg PUBLISHED/null zadatka. Povlači se iz aktivnih migracija i čuva byte-for-byte pod rejected/. Nije deployovan.

DEV u 22:46:53 UTC: pg_constraint count=0 za needs_published_category_required. Nema razloga za live DROP/migraciju.

Lokalni test izvršava tačan arhivirani SQL i postojeći taxonomy_scope_eligible_v1. Izvučeni source body i DEV pg_proc.prosrc: identičan MD5 8a1bbb43ad9c021f95cc82be5c5e5e6c, 2176 znakova. Nepotvrđen/null/stale scope nije matching autoritet. Test ne isključuje postojeći FK. DEV strict kontrola taxonomy_match_scope_control_v1.enabled=true potvrđena je u 23:02:50.473489 UTC; SELECT dokaz je u 05_PENDING_READONLY.sql Q04.

Granica: PGlite 0.5.8 / PostgreSQL 18.3, sintetičke minimalne tabele. NIJE puna DEV PostgreSQL17 publish/binder/RLS/trigger/dispatch proba.

## Devet pending slučajeva

Podaci su ponovno prikupljeni; prethodno „nije prikupljeno” više ne važi. Svih 9: source review postoji, digest prisutan, nula classificationCandidates i reviewedServiceModes, bez catalog version/fingerprint-a i bez gotovog outbox reda.

Dodatna provera Save/target aktuelnosti: **3 STALE_REPLACED, 6 UNDETERMINED**. Detalji u 05_PENDING_FORENSIC_LEDGER.csv.

Tri worker review-a imaju noviji uspešan Save istog owner-a/profila. Jednakost stare review/session revizije nije dovoljna. Aktivni binder odbija taj slučaj kodom WORKER_BINDER_NEWER_SAVE_EXISTS.

Preostala tri worker i tri need nemaju dokazan noviji Save/zamenu. To NE znači TECHNICAL_RETRY_ELIGIBLE: nedostaju trace/attempt/finishReason i dokaz uzroka. REVIEW_REQUIRED nije samo po sebi dokaz policy odbijanja ili korisničke nejasnoće.

Nijedan red nije promenjen. taxonomy_reconcile_pending_reviews_v1 samo dodaje nedostajuće pending redove, ne rešava/superseduje stare. Trenutni body MD5 7b57e773d59a41634c41911316d7b77b. Mutirajući RPC nije pozvan.

## Migraciona granica

Tri postojeće oktobarske migracije ostaju APPLIED_RECORDED_BYTES_DIFFER, ne replay-safe. Povučena je samo nova neprimenjena pogrešna zabrana. Preostalih 193 SQL fajla prolazi integrity checker. Nema novih migracija ili preimenovanja primenjenih SQL-ova.

Bez dodatne dozvole nema recovery-ja, scheduler/promena reda, novih binding-a ili obaveštenja.

## Završna provera Edge/SQL ugovora, 23:15:16 UTC

Aktivni rpc_read_worker_ai_context_service vraća WORKER_SERVICE_MODE_CONTEXT_V1, istu session reviziju i prazne nizove za odsutne saved/draft izbore. Handoff koji ne postoji izostavljen je, nije JSON null. Clarification store dopušta NULL/ON_SITE/REMOTE; category capture ne dopušta UNKNOWN. Relevantni privilegovani RPC-ovi imaju EXECUTE samo za service_role.

Store/table reason maksimum je 300 codepoint-a; prompt mora imati 8–600 nakon btrim. Pronađen source limit900 za reason ispravljen je lokalno u 147950a3: oba buildera i persistence su usklađeni, uz Unicode i cache-rejection regresije. Nema SQL izmene.

Prosrc MD5: context RPC 584ca4ae2d02e33823d9d75a92c14649; private mode-context 58a9fc44a3caf09d14c2b13579afd882; hint store 057e52a930f1649c2cced38bb162de51; proposal capture 2e8a861398c36a4efc23fa961b45897b.
