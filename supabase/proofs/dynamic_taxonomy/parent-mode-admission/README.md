# Parent navigacija, postojeći UUID i eksplicitan režim

Status ovog izvora: pripremljen za izolovani PG16/17 dokaz; nije primenjen na DEV ovim agentom. Nema novih AI poziva, objave zadatka ili slanja obaveštenja.

## Ugovor

- ON_SITE znači rad uz dolazak na mesto izvršenja; REMOTE znači bez dolaska kod naručioca. Izrada/popravka kod izvršioca uz dostavu ili preuzimanje može biti REMOTE.
- Kategorijski predak organizuje stablo. Njegovi režimi ne ograničavaju novi list i ne proširuju se zbog novog lista.
- Režimi konkretnog service UUID-ja ostaju direktne mogućnosti. REUSE_EXISTING ne može sam da doda nedostajući režim.
- EXTEND_MODE koristi postojeći UUID i tačan canonical naziv ili registrovani alias. Server dodaje categoryLabel/categoryParentId u potpisani plan kao svedočanstvo aktuelnog identiteta. Novi režim upisuje samo batch posle istog vlasničkog Save/Accept; bez novih kategorija, aliasa ili roditeljskih upisa.
- LOW_RISK, jednoznačan globalni identitet, aktuelna putanja bez ciklusa, izvor predloga, vlasništvo, ceo potpisani pregled, vidljiv konkretan režim, idempotency i post-Save revalidacija ostaju obavezni. SQL ne dokazuje fizičku izvodljivost: AI obrazloženje stvarnog rada i smislenosti režima ostaje dodatna semantička procena, a korisnik potvrđuje pregled. Sumnjiva usluga se ne čini bezbednom time što prođe listu reči.
- Stari worker capability/mode redovi se ne dopunjuju. Stvarni strict matcher i dalje zahteva aktivan, sačuvan worker+service+mode.
- Postojeći service alias i novi list mogu nositi opcioni handoff, samo za REMOTE. Odsustvo je nepoznato; required:false je izričito bez fizičke razmene; required:true mora imati zemlje dostave i/ili grad lokalne razmene. Nema pretpostavke iz grada profila.
- Handoff JSONB vrednost i redosled zemalja ostaju isti u captured hint, classificationCandidates i batch plans. Vidljiv pregled, trajno čuvanje handoff-a i dodatni matching uslov pripadaju sledećoj povezanoj migraciji 20261019104604.
- Legacy single admission podržava postojeći REUSE/CREATE_CHILD uz novu organizacionu semantiku; EXTEND_MODE ostaje odbijen u tom ulazu. Podržan tok proširenja je signed batch.
- MULTI_STOP koristi postojeći ON_SITE ugovor u task batch-u, kao i u potrebi/need binder-u.

## Izmenjene funkcije

Dva reader-a, candidate projection, capture, batch writer, legacy prepare/commit i dve binder action liste. Novi privatni helper-i: taxonomy_handoff_valid_v1 i taxonomy_category_path_valid_v1. Exact projection, risk triage, strict scope matcher i fingerprint nisu promenjeni.

Reader i dalje zahteva ESTABLISHED direktnu uslugu sa njenim režimom, pun validan put, odsustvo ciklusa i isti snapshot. Scope filtrira direktne režime; ALL ostaje istraživački default. Navigacioni anchor ne mora da podržava režim deteta. Nasleđeni nazivi grešaka sa OR_MODE ostaju kompatibilni i kad razlog više nije ancestor mode.

## Izolovani dokaz

Workflow: .github/workflows/taxonomy-new-branch-scopes-pg-proof.yml, job parent-mode-admission.

1. fixture.sql preuzima postojeću sintetičku Save/receipt infrastrukturu i učitava exact trenutno pročitane funkcije.
2. assert-before.sql demonstrira stari parent-mode blocker, odbijanje EXTEND_MODE i odbijanje čitanja legitimnog remote lista.
3. Primena nove migracije proverava 13 hash preuslova i čuva owner/ACL/search_path/volatility postojećih funkcija.
4. assert.sql proverava novi list i oba njegova režima, isti UUID pri proširenju, stvarne need/worker bindere, strict scope sa starim i opozvanim worker režimom, canonical/alias handoff, stale/wrong-owner/safety/identity odbijenice, post-Save nepovezanu i relevantnu promenu, legacy Save granicu i MULTI_STOP.
5. revert.sql vraća exact prethodne definicije i uklanja dva nova helper-a; ponovna demonstracija pre stanja i ponovna primena moraju proći.

Sve poslovne vrednosti u dokazu su sintetičke. Podešavanje test auth GUC-a postoji samo u disposable fixture-u; nije način za prijavljivanje ili testiranje živih naloga. Predecessor JSON beleži read-only metadata, ne korisnički dijalog.

## Granice dokaza

Nije dokaz korisničkog UI prikaza handoff-a, fizičke izvodljivosti proizvoljne usluge, stvarnog dispatch-a/push-a, niti automatskog popravljenja ranije sačuvanih unresolved nacrta. Pre primene celog paketa proveriti povezanu Edge verziju, full-review client decode/prikaz i narednu handoff persistence migraciju.
