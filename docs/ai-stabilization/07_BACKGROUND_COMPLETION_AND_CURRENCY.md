# Background completion, potvrda upisa i karakterizacija cene — 2026-10-27

Ovaj objedinjeni dokaz obuhvata BGL-03, BGL-04, bezbedno logovanje i CUR01. Prva tri dela su lokalne popravke; CUR01 i HOURLY su reprodukovani otvoreni problemi, ne završene funkcionalnosti. Polazni lokalni/remote commit: `cb6a1fd0468e8f279a0a24f1f71bf9fb941dd402`; njegov prethodni GitHub CI run `40423068239` je SUCCESS. Ništa iz ovog nastavka nije deployovano.

## BGL-03 — detalj potvrde pozadinskog upisa

Reviewer: conversation_path_review. Polazni commit: cb6a1fd0.
Status: LOCAL VERIFIED za dijagnostiku store/capture potvrde. Nije DEPLOYED ni živi E2E.
Ovaj izveštaj dopunjuje raniji 06_BACKGROUND_LIFECYCLE_REVIEW.md; ne proglašava durable background recovery završenim.

## Rezultat

Oba dual Edge callback-a sada proveravaju postojeće rezultate umesto da tihi neuspeh ostane nevidljiv:

- persistClarificationHint false emituje fiksni NEED_TAXONOMY_HINT_STORE / WORKER_TAXONOMY_HINT_STORE sa statusom UNAVAILABLE.
- Capture RPC potvrda proverava već postojeći SQL ugovor action=HINT_CAPTURED i authority=NONE.
- NEED transport vraća {ok,data}; neuspešan HTTP, pogrešan ACK ili exception daju postojeći NEED_TAXONOMY_HINT_CAPTURE / UNAVAILABLE.
- WORKER transport vraća direktan SQL objekat, a neuspešan HTTP baca exception. Malformed ACK daje postojeći WORKER_TAXONOMY_HINT_CAPTURE / RECEIPT_UNEXPECTED; transport/catch daje UNAVAILABLE.

Nema novog RPC-a, modelskog poziva, retry-ja, helper arhitekture, DB izmene, UI poruke ili novog autoriteta. Glavni razgovor i dalje dobija final SUCCEEDED. Razjašnjenje stvarne poslovne nejasnoće nije provider failure.

## Dokaz pre popravke

Novi background_capture_receipt.test.mjs pokreće oba stvarna aktuelna handlera preko postojećih VM/transpile harness-a, sa stvarnim Request/Response/ReadableStream primitvima i isključivo sintetičkim transportom. Ne zamenjuje funkciju koja pravi klasifikaciju niti handler izmišljenim rezultatom; sintetički su Auth/RPC/provider odgovori.

Prvi prolaz: 32 testa, 4 PASS i 28 FAIL. Validni store/capture odgovori već su prolazili. Svi malformed, false, HTTP503 i thrown slučajevi završili su uspešan razgovor, ali su bili crveni zato što fiksna dijagnostika nije emitovana.

Test pre proveravanja loga potvrđuje:

- samo jednu conversation completion operaciju;
- store/capture je pozvan posle completion-a, ne pre njega;
- tačan account/conversation/clientRequest/turn/attempt identitet pri capture-u;
- store reviziju NEED max sequence 6 + 2 = 8 i WORKER candidate revision 4 + 1 = 5;
- postojeće purpose vrednosti NEED_SERVICE i WORKER_CAPABILITY;
- jedan glavni i jedan architect provider zahtev, bez automatskog ponavljanja;
- nema Save/publish/admission/push poziva;
- nema UUID-a, service/opisa/pitanja/reason teksta, transport tela ili izuzetka u logu;
- semantička clarification putanja ne emituje BG_TAXONOMY_PROVIDER_FAILURE.

Ovo dokazuje nedostajuću obradu dijagnostike u source-u, ne tvrdi da DEV trenutno vraća ove malformed odgovore.

## SQL i transport ugovor

| Operacija | Stvarni relevantni ACK | Granica |
| --- | --- | --- |
| Store clarification | {stored:true,draftRevision:p_draft_revision} | Tačna numerička revizija; stale/closed stored:false nije potvrđen upis. |
| Capture proposal | {action:'HINT_CAPTURED',authority:'NONE'} | Nema echo owner/revision polja u ACK-u; ne dodajemo ih proizvoljno. |
| NEED RPC helper | {ok,status,data} rezultat boundedJson | Potrebni su ok i validna data potvrda. |
| WORKER RPC helper | SQL data direktno, exception za ne-ok HTTP | Malformed odgovor i transport failure ostaju različiti postojeći statusi. |

Pročitan je ceo retained revision-fence migration 20261026150523_classification_hint_revision_fence.sql. Store se vezuje za trenutnu reviziju otvorenog razgovora. Pročitan je istorijski capture SQL gemini-turn-review-hints-v1.sql i capture deo create-new-branch-v3-forward-dev.sql: service-role gate, uspešan turn sa tačnim owner/request/attempt identitetom, fingerprint/digest i replay konflikt ostaju autoritet.

Raniji izveštaj 06_BACKGROUND_LIFECYCLE_REVIEW.md zasebno beleži read-only pregled živih SQL tela i potvrđuje isti store/capture ACK. Ovaj agent nije u ovom koraku ponovo pozivao DEV niti izvršavao RPC. Candidate SQL nije predstavljen kao dokaz identičnih deployovanih bajtova.

## Konačni testovi

Finalni test fajl ima 40 slučajeva:

- 4 pozitivna valid-store/capture slučaja;
- 28 malformed/false/HTTP/exception slučajeva;
- 4 unchanged-followup karakterizacije;
- 4 diagnostic-log-sink-failure slučaja.

Posle lokalne popravke: 40/40 PASS. Na zamrznutim integrisanim runtime bajtovima, zajedno sa parent background_runner.test.mjs: 45/45 PASS. TypeScript nakon freeze-a: npx --no-install tsc --noEmit, exit 0.

Širi ciljani prolaz za capture, runner, prethodne lifecycle/ACK, background failures/scope i oba postojeća Edge test fajla: 349/349 PASS. Taj širi prolaz je pokrenut tokom koordinisane lifecycle integracije; konačnih 45/45 i poslednji TypeScript su ponovljeni posle freeze-a. Parent radi završni ukupni suite.

Komande:

```powershell
node --test --test-reporter=spec supabase/proofs/ai/background_capture_receipt.test.mjs supabase/proofs/ai/background_runner.test.mjs
node --test --test-concurrency=2 --test-reporter=spec supabase/proofs/ai/background_capture_receipt.test.mjs supabase/proofs/ai/background_runner.test.mjs supabase/proofs/ai/background_lifecycle_review.test.mjs supabase/proofs/ai/background_taxonomy_failures.test.mjs supabase/proofs/ai/background_taxonomy_scope.test.mjs supabase/proofs/ai/v5_ai_stream.test.mjs supabase/proofs/ai/v5_worker_edge.test.mjs
npx --no-install tsc --noEmit
```

Unchanged-followup test koristi isti VM/handler i novi request/turn/attempt identitet. Transport zatim eksplicitno vraća kanonski sačuvanu uslugu pri sledećoj reviziji, bez hinta koji nije uspeo da se sačuva. Sledeća poruka menja samo opis/ne predlaže nove facts. Rezultat: dve uspešne glavne poruke, ali samo jedan ukupni architect call i jedan pokušaj store/capture. Ovo je source karakterizacija nad sintetičkim kanonskim readback-om, ne PostgreSQL transakcioni simulator.

Log-sink test baca samo pri novom fixed diagnostic događaju. Uspešan final ostaje netaknut i waitUntil task se završava bez unhandled rejection-a. Parent runInBackground guard je proveravan zasebno; nema dodatnog paidcall-a da nadoknadi log ili capture problem.

## Nezavisni pregled parent logging izmene

Pročitan je diff runInBackground i ceo background_runner.test.mjs:

- više se ne čita error.message niti potencijalno opasan getter;
- jedini error događaj je fiksni BG_TAXONOMY_ARCHITECT_WARN / FAILED;
- neuspeh console.warn je uhvaćen;
- postojeći Promise.resolve fallback rezultat i EdgeRuntime.waitUntil(safe) registracija nisu menjani.

Pet testova prolazi. Sam exception iz waitUntil registracije nije pokriven niti mu je ponašanje menjano. Ne treba tvrdnju širiti na sve moguće runtime API kvarove.

Supabase skill je usmerio proveru na stvarni RPC ACK i nenarušavanje background/foreground granice. [Zvanična dokumentacija](https://supabase.com/docs/guides/functions/background-tasks) potvrđuje da waitUntil označava nenametljivo pozadinsko izvršavanje, ali ga i dalje ograničavaju runtime limiti; to nije trajni red poslova. Pregledan je i [aktuelni changelog](https://supabase.com/changelog); nije rađena promena Supabase API-ja ili zavisnosti.

## Ostaje otvoreno

- Dijagnostika nije durable classifier retry ni recovery. Unchanged-followup test upravo pokazuje da neuspešan rezultat ne postaje automatski ponovni poziv.
- Post-save outbox nije zamena za rezultat klasifikatora koji nikada nije sačuvan.
- Consume false/exception caller dijagnostika nije proširivana u ovom patchu; postojeći helper ACK/cache zaštita ostaje.
- BGL-04 pre-completion abort/timer promene pripadaju odvojenom lifecycle agentu i opisane su niže.
- Nema nove potvrde stvarne latencije, provider kvaliteta, Save/matching/push toka ili deploymenta.

## Evidencija i vlasništvo

Zaseban manifest review-bg-capture-20261027.json navodi stvarno FULL/PARTIAL čitanje i SHA256. Index fajlovi su u ovom prolazu PARTIAL, sa tačnim pregledanim opsezima; raniji sveobuhvatni pregledi nisu ponovo predstavljeni kao novi.

Ovaj agent je menjao samo dual store/capture ACK dijagnostiku u dva index.ts fajla, novi background_capture_receipt.test.mjs i ova dva zasebna dokumenta. Lifecycle agent je zatim koordinisano izmenio lifecycle delove istih index fajlova i test-only waitUntil injection u dva harness-a. Parent je vlasnik shared runInBackground izmene. Centralni ledger/status ovaj agent nije menjao.

Nema commit-a/push-a/deploy-a ili remote upisa od ovog agenta.

## BGL-04 — životni vek od stvarnog pokretanja klasifikatora

Pre izmene oba handlera pokretala su classifier pre conversation completion RPC-a, ali su ukupan devetosekundni rok i pozadinsku registraciju postavljala tek posle uspešnog completion-a. Neuspeh, neispravan odgovor ili otkazivanje između ta dva koraka ostavljali su već započeti posao bez te ukupne kontrole. Pojedinačni transportni rokovi nisu isto što i ukupan rok posla.

Mala inline izmena u postojećim handlerima:

- Postojeći rok od 9 sekundi počinje pri pokretanju klasifikatora, uključujući vreme dok se čeka completion. To nije rok za ceo glavni AI razgovor.
- Abort zahteva do potvrđenog completion-a prekida BG odmah; neuspešan/neispravan completion zatvara listener i timer u finally bloku. NEED PROCESSING/FAILED takođe ne ostavlja taj posao aktivnim.
- Tek validan SUCCEEDED receipt odvaja BG od request signala i nastavlja ga kroz postojeći waitUntil. Normalno zatvaranje stream-a tada ne poništava klasifikaciju.
- Capture/store ostaje iza uspešnog completion-a, sa nepromenjenim account/request/turn/attempt i revision uslovima.
- Consume ranijeg pitanja pripada potvrđenom razgovoru, ne roku nove klasifikacije. Dobija nezavisan signal, uz isti postojeći RPC timeout od 2,5 sekundi; nema nove queue ili novog poziva.

Novi exact-handler lifecycle test: početno 12 slučajeva, 2 PASS / 10 FAIL. Finalno **16/16 PASS**: neuspešan i neispravan completion, otkazivanje, held completion, rok pre completion-a, uspešan nastavak posle zatvaranja stream-a, consume posle isteka BG roka i consume bez BG-a. Timeri se kontrolisano aktiviraju u testu; nije čekano devet sekundi niti merena živa brzina. Abort prekida lokalni transport; ne dokazuje rollback već poslatog udaljenog zahteva. Nezavisni peer review celog diff-a i svih 16 testova nije našao blocker.

Shared runInBackground sada beleži samo fiksni FAILED status, ne exception tekst ili message getter; neispravan logger ne pretvara već obrađenu grešku u novi rejection. Novi paket: početno 1 PASS / 4 FAIL, posle izmene **5/5 PASS**. Uspešan fallback rezultat i postojeća waitUntil registracija ostali su isti. Promena ne obećava trajno izvršavanje kroz restart ili kvar runtime-a.

## CUR01 — reprodukovana neusklađenost cene, BEZ popravke baze

Read-only DEV pregled 27.10.2026. u 04:43–04:46 UTC proverio je tela 13 odabranih funkcija, 11 trigger zapisa/tela i relevantne metadata/registry redove. Korišćeni su SELECT upiti, bez korisničkih podataka, mutirajućih RPC poziva ili Geminija. Tačan obim i MD5 su u review-currency-20261027.json. Ovo nije nova potvrda deployovanih Edge verzija.

Novi offline PGlite dokaz izvršava stvarni lokalni Edge guard i hash-om vezane žive SQL funkcije nad minimalnim sintetičkim tabelama. Rezultat **10/10 PASS** znači da je postojeći problem reprodukovan:

1. Razgovor ima potvrđenih 5.000 RSD. Korisnik ispravi „u evrima”. Edge daje CLARIFY i uklanja nove predloge cene, ali nema komandu za povlačenje stare cene.
2. Stvarni fact writer zapisuje dve poruke, ne povlači stari CONFIRMED RSD fact. Osnovni V2 review i dalje prikazuje 5.000 RSD i canSaveDraft=true.
3. Poruke menjaju source materijal starog potpisanog pregleda, ali novi pregled zadržava stari iznos. Naknadni nezavisni ALLOW uklanja safety upozorenje, ne staru cenu.
4. Kontrolni slučaj sa novim eksplicitnim iznosom u RSD pravilno superseduje stari amount i traži potvrdu vlasnika. OFFERS fact writer zadržava stare amount/basis činjenice, ali canonical Need Save zasebno nulira non-MY_PRICE iznos; ne tvrdimo saved-Need grešku na osnovu fact fixture-a.
5. SQL validator podržava TOTAL/PER_PERSON/HOURLY; postojeći Edge PER_HOUR guard ipak uklanja price facts. To je zasebno reprodukovana neusklađenost, ne razlog da bez ostatka ugovora samo uklonimo zaštitu.

Granice: nisu izvršeni full signed prepare/accept/publication, RLS, closure/retention trigger-i, concurrency ili već sačuvani DRAFT tok. canSaveDraft nije potvrda objave. Nije dokazan incident na stvarnim korisničkim podacima. Postojeći RSD→EUR TODO ostaje vidljiv; stari rollback-only kandidat nije primenjen niti prekopiran u forward migraciju.

Najmanji sledeći SQL korak tek posle odgovarajućeg F0/F1 ugovora mora da pokrije atomsku revision-bound promenu namere cene, potpisani novi review i zaštitu već sačuvanog DRAFT-a pri objavi. Očuvati consent, OFFERS i HOURLY; bez prećutnog pretvaranja EUR u RSD.

## Evidencija pregleda ovog nastavka

Zasebni snapshot manifesti: review-background-completion-20261027.json, review-bg-capture-20261027.json i review-currency-20261027.json. Centralni reviewed-files.json i FILE_REVIEW_LEDGER daju trenutni zbir; raniji snapshot manifesti ostaju istorijski dokaz, ne prepisuju se novim hash-evima.

FULL iz ranijeg pregleda može ostati FULL samo uz proveru celog diff-a od tog pročitanog sadržaja. To je kumulativan pregled, nije tvrdnja da je ceo veliki handler ponovo pročitan u ovom prolazu. Requester index ostaje PARTIAL. Izvršavanje svih testova i automatski inventar ne računaju se kao čitanje svih fajlova.

Durable recovery neuspešno sačuvane klasifikacije ostaje otvoren: unchanged-followup dokaz pokazuje da sledeća nepovezana poruka ne ponavlja classifier automatski. Novi log statusi i kontrolisan životni vek nisu zamena za trajni retry. Nema nove arhitekture, migracije, masovnog retry-a ili brisanja.

## Završna integracija

- `937c0780`: objedinjena runtime popravka, dva test harness priključka i 61 novi ACK/lifecycle/logging slučaj.
- `7ef48bb8`: 10 novih currency characterization slučajeva, bez SQL runtime izmene.
- Sva četiri nova paketa zajedno: **71/71 PASS** na konačnim kodnim bajtovima.
- Cela AI grupa: **927 ukupno, 926 PASS, 0 FAIL, 1 postojeći TODO**.
- Mobilni Jest: **622 paketa, 14.143 testa, 3 snapshot-a, sve PASS**.
- Dodatni CI paketi: **55/55** i **114/114 PASS**; prvi uključuje 24 PG i 31 signed/question-policy slučaj.
- TypeScript i Deno 2.5.6 offline check sva tri Edge ulaza: PASS. Requester @ts-nocheck ostaje postojeće ograničenje, ne puna type/runtime provera.
- Migration integrity: **193 SQL fajla**, Python **15/15 PASS**.

Brojevi se preklapaju. Nijedan test nije živi Gemini/DEV/telefon E2E. Supabase skill je usmerio proveru na postojeći ACK i waitUntil ugovor; korisnička zabrana deploy-a i remote upisa ostala je na snazi. GitHub završni CI je zaseban korak posle dokumentacionog commit-a, ne pretpostavlja se iz lokalnog prolaza.
