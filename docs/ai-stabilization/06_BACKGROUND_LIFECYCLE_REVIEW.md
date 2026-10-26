# F0 — background classification lifecycle review

Datum: 2026-10-27. Reviewer: `classifier_failure_review`.
Početni commit: `5e7790e8445e09f38275ec19bdb86e8948c66558`.
Obim: source review, sintetički offline transporti, povezani SQL ugovori. Ovo nije živi Gemini/Save/E2E test niti potvrda da je lokalni patch deployovan.

## Rezultat ove celine

Dokazane i lokalno popravljene dve greške, bez promene arhitekture:

1. Prekinuto čitanje post-save HTTP tela i nevalidan UTF-8 pogrešno su postajali terminalni `BATCH_REVIEW_REQUIRED`. Sada su, kao nevalidan JSON i ostali neizvesni transportni odgovori, `TEMPORARY_UNAVAILABLE`; isti signed job/request key ostaje za postojeći SQL retry.
2. Clarification store/consume prihvatali su nepotvrđen RPC odgovor kao uspeh; consume je brisao lokalnu vidljivost pre potvrde baze. Sada se proveravaju stvarni relevantni ACK podaci i tačna numerička revizija pre izmene cache-a. `consumed: 0` je i dalje validan idempotentan uspeh.

Nema nove migracije, deploya, stvarnih Gemini poziva, remote upisa, obaveštenja, niti commit/push operacije ovog subagenta. Centralni ledger i client moduli nisu menjani.

## Stvarni tok i granice

| Faza | Source/ugovor | Šta greška zaista radi |
| --- | --- | --- |
| Ulaz i model | task/worker Edge + typed context | Glavni razgovor ima odvojeno čuvanje i proveru completion receipt-a. Background rezultat sam ne potvrđuje consent. |
| Start klasifikacije | task fingerprint; worker skills/current USER-quoted mode change; pending hint | Samo relevantna promena ili postojeće pitanje pokreće dual BG. Neizmenjen sledeći turn nije generički retry prethodnog neuspeha. |
| BG provider/catalog | `backgroundTaxonomyArchitect.mjs` | S09/S10 vraća odvojene tehničke failures, ne izmišlja korisničko pitanje; nema podrazumevanog ON_SITE iz kataloga/grada. |
| Completion | task `+2` message rev; worker `+1` candidate rev | Hint persistence/capture nastupa tek posle proverene uspešne completion. BG računanje već može biti pokrenuto pre nje. |
| Clarification persistence | store RPC + exact-revision cache | SQL odbija stale/closed revision. Lokalni ACK fix sada odbija nevalidan ili pogrešan receipt bez zagrevanja cache-a. |
| Clarification potrošnja | consume RPC exact cid/rev/service | Nula pogođenih redova je validna. Lokalna potrošnja sledi tek po validnom ACK-u. Sledeći normalni turn koristi novu reviziju. |
| Proposal capture | `rpc_taxonomy_capture_gemini_turn_hints_service` | Owned successful turn/attempt, source fingerprint i immutable digest; duplikat iste stvari je idempotentan, drugačiji replay je konflikt. Capture nije admission. |
| Signed review / Save | postojeći SQL authority boundary | Samo korisnikov potvrđeni pregled ulazi u katalog/admission. Background nije worker capability, objavljen task, niti push dozvola. |
| Post-save outbox | reconcile → lease claim → commit → finalize | Finalize proverava postojeći DB receipt i lease. Izgubljen finalize odgovor ostavlja lease za recovery. Commit ponavlja isti request key, ne novi posao. |
| Binding | posebna feature gate + DB binding tick | Katalog COMMITTED nije isto što i binding. Binder ponavlja owner/review/revision provere; notification/dispatch authority ostaje NONE. |

Candidate SQL fajlovi opisuju istorijski source ugovor, nisu dokaz identičnih živih bajtova. Tačno potvrđeni live delovi navedeni su ispod. Nije ovde tvrđeno da je svaki caller/SQL binder pročitan u celosti; manifest razlikuje FULL/PARTIAL.

## BGL-01 — post-save transport failure pogrešno postaje review [FIXED SOURCE]

Lokacija: `supabase/functions/uskoci-taxonomy-postsave-worker/index.ts`, `boundedJson`, i `supabase/functions/_shared/taxonomyPostSaveWorker.mjs`, commit catch.

Pre popravke `JSON.parse` failure imao je `retryable: true`, ali fatal UTF-8 decode i `reader.read()` exception nisu. Shared processor je običnu exception klasifikovao kao `BATCH_REVIEW_REQUIRED`. Live finalize taj kod šalje u REVIEW_REQUIRED i ne primenjuje retry backoff.

Minimalni patch hvata samo read/decode/parse deo ograničenog HTTP tela i prevodi neizvesni receipt u postojeći `Unavailable(true)`. Sačuvani su: 32,768-byte limit, signal/24-second deadline, reader cancellation, isti job/request key, HTTP 400/403 kao semantic/review, HTTP 429/503 kao retry. Nema automatskog ponavljanja modela ili samovoljnog odobravanja posla.

Red-before: početna 3 testa — malformed JSON PASS, invalid UTF-8 FAIL, errored stream FAIL (`BATCH_REVIEW_REQUIRED` umesto `TEMPORARY_UNAVAILABLE`). Green: 9 novih transport testova. Zajedno sa postojećim post-save processor testovima: 19/19 PASS.

Razlika limit/cancel: streaming preko limita dolazi do `finally` i otkazuje reader; prevelik Content-Length odbija se pre `getReader`. Rano header odbijanje ni ranije nije eksplicitno otkazivalo celo telo; to nije menjano u ovom patchu. Test ne tvrdi da je header odbijanje isto što i reader cancellation.

## BGL-02 — nevalidan store/consume ACK menja cache [FIXED SOURCE]

Lokacija: `backgroundTaxonomyArchitect.mjs`, `persistClarificationHint` i `persistConsumeClarificationHint`.

Pre popravke sintetički `null`, `{}` i `{stored:true,draftRevision:99}` pri traženoj reviziji 4 vraćaju `true` i pune cache. Consume sa `{ok:false}` vraća `true` i lokalno skriva hint; i thrown transport error je prvo skrivao hint. To nije dokaz da DEV vraća te malformed odgovore, već dokaz da lokalna granica nije prepoznavala nedostatak potvrde.

Posle popravke:

- store zahteva `stored === true` i `draftRevision === requestedRevision`;
- consume zahteva safe integer `consumed >= 0` i istu numeričku reviziju;
- i direktni SQL objekat i postojeći `{ok:true,data}` transport su podržani;
- eksplicitno neuspešan wrapped odgovor, null/empty/wrong/string revision, nevalidan count i exception ne prijavljuju uspeh i ne menjaju cache;
- Unicode reason limit i isti tekst za RPC/cache ostaju netaknuti;
- eksplicitna stara no-RPC local-only grana ostaje nepromenjena; stvarni Edge caller-i uvek daju RPC.

Red-before za kompletan novi lifecycle fajl: 38 testova, 17 PASS / 21 FAIL. Od toga 20 malformed ACK slučajeva i thrown consume/cache slučaj crveni; pozitivni direct/wrapped/count-zero slučajevi već su prolazili. Green: 38/38. Dva postojeća reason-bound fixture-a usklađena su sa živim ACK-om (`draftRevision`), bez ublažavanja assertion-a.

Cache divergence sama po sebi ne dokazuje da korisnik dobija ponovljeno pitanje u normalnom narednom turnu: successful completion već je pomerila reviziju, a SQL get je exact-current-revision fenced.

## Otvoreno — nije predstavljeno kao završeno

### BGL-03: dual capture/persist neuspeh je još uvek tih; nema durable BG retry [OPEN]

Task Edge oko 1586–1603 i worker Edge oko 561–579 ignorišu boolean rezultat `persistClarificationHint`, ne proveravaju success capture ACK i imaju prazan non-fatal catch. Ne-dual capture grane proveravaju ACK i pišu fixed status. Provider failure rezultati su sada bezbedno razdvojeni, ali `failures` nije durable retry zapis.

Ako hint/proposal nije sačuvan, replay završenog turna nije nova klasifikacija, a sledeći semantički neizmenjen turn često ne aktivira BG. Post-save outbox ne rešava nedostajući classifier rezultat: obrađuje već formirane signed review candidate plans. Pending ledger kandidat beleži pending stanje i rekonstruiše propušten zapis; nije classifier niti resolver. Zbog toga ne treba obećati da će svako PENDING stanje samo od sebe nestati.

Preporučen sledeći mali korak: proveriti i evidentirati postojeći capture ACK fiksnim statusima bez PII, dodati failure/unchanged-turn regression. Durable retry ili prepravka publishability zahtevaju zaseban dogovor i ugovor; nisu dodati ovde.

### BGL-04: životni vek pre-completion BG [SOURCE RISK, NOT LIVE REPRODUCTION]

Oba Edge-a kreiraju BG promise pre `complete` RPC-a, a 9-second BG abort timer i `waitUntil` se postavljaju tek posle uspešne completion. Ako completion padne, taj BG controller se u prikazanoj putanji ne abortuje. SQL capture fence i dalje sprečava neovlašćeno čuvanje; potencijalni problem je nepotreban rad/provider poziv i lifecycle observability, ne dokazan prodor authority. Potreban je zaseban exact-handler failure test pre patcha.

### BGL-05: cache/loader i dijagnostika [OPEN, lower priority]

- Hint cache čuva timestamp ali nema TTL/eviction; SQL get ograničava na poslednji dan. Offline Date.now proba pokazuje da cache i posle 24h vraća isti-revision hint. Nije dokaz da trenutni Edge isolate toliko traje.
- Novel CREATE_CHILD cache ključ koristi catalogVersion, service, mode i scope, ali ne catalogFingerprint; full catalog cache koristi oba. Ista version sa promenjenim fingerprintom može ostaviti raniju odluku u cache-u. Nije popravljeno niti odrađena kompletna scenario reprodukcija.
- Fallback catalog tree walk ima šest iteracija/batches po 32, ne proveru da je red do kraja iscrpljen. Validan snapshot je primarna putanja; širok/deep fallback mora dobiti poseban completeness test pre izmene.
- Provider failure logger koristi fiksne code/status bez user prose; opšti `runInBackground` catch još loguje `err.message`. Uočeno source pregledom, bez emitovanja stvarnog privatnog sadržaja. Nova dva patcha ne dodaju logove.
- Post-save komentari kažu default OFF, ali `devTaxonomyFlagP1` automatski uključuje canonical DEV kada nije eksplicitno false. Komentar nije dokaz da worker ne radi. Nije menjano ponašanje flagova.

## Read-only DEV ugovori potvrđeni sa SQL agentom

Iz pročitanih živih function bodies, ne izvršavanja RPC-a:

- Store success tačno `{stored:true,draftRevision:p_draft_revision}`; stale/closed success-envelope nije uspeh (`stored:false`). SQL bigint se vraća kao JSON broj, ne string.
- Consume `rpc_taxonomy_consume_turn_hint_revision_service(uuid,bigint,text)` vraća `{consumed:v_count,draftRevision:p_draft_revision}`; integer zero je legitiman. Scope je isti cid/rev/unconsumed/optional service; ne proverava da je to i dalje current revision. Inspected 2026-10-26 23:36:10 UTC, prosrc MD5 `720f4da5965c354d06b8d0871a8cb5c3`.
- Capture success tačno `{action:'HINT_CAPTURED',authority:'NONE'}`. Invalid turn/replay podiže SQL grešku.
- Finalize body, prosrc MD5 `af9cd22b779037a8c9f7fad5c8543cfe`, proveren u 23:15/23:34 UTC: TIMEOUT/NETWORK_UNAVAILABLE/TEMPORARY_UNAVAILABLE uz attempts < 5 → RETRY; ostalo → REVIEW_REQUIRED. Backoff min(1800, 15 × 2^attempts).

Ovo potvrđuje kompatibilnost lokalne validacije, ne potvrđuje deployment ovog patcha niti uspeh živog korisničkog toka.

## Testovi i nezavisni peer review

- 87/87 PASS pre zasebnog ACK patcha: lifecycle9 + postsave10 + S09/S10 failures43 + scope19 + fingerprint2 + revisionSQL4.
- Posle ACK patcha lifecycle38 + scope19: 57/57 PASS.
- `node --test supabase/proofs/ai/*.test.mjs`: 856 testova, 855 PASS, 0 FAIL, 1 postojeći TODO (43.85 s). TODO je `ai_edge_context.test.mjs:754`: atomic writer/review invalidation RSD → EUR; nije rešavan ovom celinom.
- `git diff --check` za ovu celinu: bez whitespace greške.

Nezavisno pregledan parent diff `classificationGeminiShadow.mjs`, ceo `classificationReply.mjs` i relevantna tri test fajla. `canOfferReview` i dalje koristi sve issues/proposals, nema skraćivanja same liste problema; samo `questions` ima jedan element. `withClassificationFeedback` čuva facts i raniji review/safety guard. Targeted testovi 24/24 PASS. Nije pronađena regresija; ovo nije dokaz da svaki proizvoljan provider odgovor već sadrži samo jedno pitanje, niti živi E2E.

Nezavisni C01 peer review: pročitan client service, serverReceipt i novi client test; prvih 11/11 offline testova prolazilo je, ali je pronađen nedostajući ugovor. Publication agent je iz FULL live SQL tela potvrdio da isti review + NOVI neiskorišćen request key legitimno vraća već postojeći command sa STARIM key-em (`rpc_accept_ai_task_review`, body MD5 `535fa065c24b514423af8d04a8a58574`). Strogi novi accept key guard bi false-rejectovao legitiman canonical replay. Nalaz je poslat parentu i client agentu, koji su taj guard uklonili: accept ostaje canonical-by-review, dok odabrani resume/publish ostaje key-bound. Ponovo pregledan konačan diff i ceo dopunjeni test: 12/12 PASS, uključujući benigni replay i naknadni read-only resume. U konačnom patchu nije pronađena preostala regresija C01 ugovora. Ovaj subagent nije menjao client source/test.

Hashes i obim stvarnog čitanja nalaze se u `review-background-20261027.json`. Parent je lokalne BGL ispravke komitovao kao `8f6e0627`; one-question celina je `c74211ed` (potvrđeno lokalnim git logom). Ovaj subagent nije komitovao/pushovao niti deployovao; lokalni commit nije dokaz deploymenta.
