# AI razgovori: topao ton bez novih poslovnih pretpostavki

**21.10.2026 — izvor i DEV deploy potvrđeni; kvalitet živog razgovora još nije potvrđen.**

## Stanje pre ove izmene

- Oba intervjua već uvoze isti glas iz `supabase/functions/_shared/interviewVoiceInstruction.mjs`: task `supabase/functions/uskoci-ai-interview/index.ts:444`, worker `supabase/functions/uskoci-worker-interview/index.ts:184`. On već traži srpsku latinicu, „ti“, kratak prijateljski odgovor i povremen, uslovan 🙂/👍. Zbog toga ovaj paket nije uvođenje topline od nule.
- Ranija stvarna ograničena DEV proba zabeležena je u `docs/current/AI_WARMTH_TIMING_20261019.md`: 14 QA poruka, 25 modelskih poziva, primer toplog odgovora; to su istorijske verzije task 112 / worker 67, ne dokaz sadašnjih razgovora.
- Poslednji lokalni DEV presek `outputs/USKOCI-NATIVE-20261021/NAJNOVIJI-PRESEK-20261021.md` (izvan repozitorijuma) beleži task v118 i worker v72 kao ACTIVE. Taj presek nije ponovljeni live test tona.

## Ograničena izmena

Zajednički glas sada traži da AI prvo prepozna **konkretan cilj ili prepreku** iz tekuće poruke, pa postavi sledeće korisno pitanje. Izbačen je zadatku specifičan primer „ne znam budžet → Tražim ponude“ iz zajedničke instrukcije: mogao je da sugeriše izbor cenovnog režima bez korisnikove potvrde i nepotreban je u razgovoru o radnom profilu. Ostaje izričito pravilo da ponuđena opcija nije izabrana dok je korisnik ne potvrdi. Povremeni smajli i granice protiv izmišljenih podataka, lažnog čuvanja, tepanja i šale u osetljivom trenutku ostaju.

Ovo menja samo **zajedničko uputstvo za ton**, ne strukturu odgovora, serverski writer, prava ili stanje sačuvanih nacrta.

## Provera i granica dokaza

- `node --test supabase/proofs/ai/ai_edge_context.test.mjs supabase/proofs/ai/v5_worker_edge.test.mjs`: **223/223 PASS, 0 FAIL** lokalno. Task harness je dopunjen dozvoljenim lokalnim importom postojećeg `taskApplicationDeadline.ts`, a očekivanje skupa ključeva sada poštuje OFF zastavicu za opcioni rok prijava. To proverava sklapanje prompta i transportne ugovore, **ne kvalitet Gemini odgovora**.
- Na DEV projektu `leqcwgzvjsxugfgzdmth` 21.10. deploy je napravio task AI **v119** i worker AI **v73**. Pre deploy-a je potvrđeno da je staro aktivno uputstvo jednako Git HEAD-u; preneti su aktivni fajlovi svake funkcije uz zamenu samo zajedničkog uputstva. Naknadni `get_edge_function` readback potvrđuje `ACTIVE`, tačan novi tekst i identične ostale fajlove (20 task, 18 worker). `verify_jwt=false` je zadržan kao u v118/v72, a javni POST bez prijave za oba endpointa vraća 401 iz sopstvene autentifikacije. Ovo nije potpisan Gemini razgovor.
- Za live prihvatanje na izolovanim QA razgovorima oba intervjua treba proći: (1) slobodan opis sa više činjenica, (2) ispravka jednog podatka, (3) „ne znam budžet“ bez prećutnog OFFERS, (4) radnik sa dva grada ili celom Vojvodinom bez lažno aktivne oblasti, (5) remote fizički rezultat sa predajom, (6) greška/odbijanje bez veselog smajlića. Za svaki slučaj uporediti tekst, predložene činjenice, pregled i stvarni Save/objavu; posebno meriti ponovljena pitanja i vreme odgovora.
- Dok se ti razgovori ne izvedu na aktivnoj verziji i pregled ne potvrdi usklađenost, nema tvrdnje da je model uvek topao, brz ili nepogrešiv.
