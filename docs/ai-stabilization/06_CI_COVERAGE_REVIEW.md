# F0 — CI, build konfiguracija i jedno pitanje

Datum: 27.10.2026. Početni HEAD: `5e7790e8445e09f38275ec19bdb86e8948c66558`.
Ovo je nastavak stvarnog pregleda, ne zatvaranje F0 niti potvrda celog proizvoda.

## Popravljen sukob pravila razgovora

`classificationGeminiShadow.mjs` je u uslovnoj shadow/research putanji i dalje tražio do TRI pitanja. `classificationTurnFeedback` je izlagao do tri pitanja istovremeno, iako MASTER traži jedno neophodno pitanje po koraku.

Oba NEED/WORKER, chat/research uputstva sada traže najviše jedno pitanje. Feedback prikazuje jedno, ali čuva **sve** issues/proposals i postojeći `canOfferReview` uslov. Nema gubitka činjenica, prećutnog odobrenja pregleda ili uklanjanja ostalih nejasnoća. Naredni odgovor može razjasniti sledeću stavku.

Novi `shadow_one_question.test.mjs`: 6 neuspeha pre izmene, zatim 6/6 PASS. Test čuva kompletan typed draft i proverava da ostale nejasnoće sprečavaju prerani review. Postojeće očekivanje broja pitanja usklađeno je sa novim ugovorom. Stari source-regex za NEED uputstvo usklađen je sa već postojećim značenjem bez promena authority uslova. Nezavisni background reviewer nije našao regresiju. Ovo nije obećanje da svaki proizvoljan modelov odgovor sada ima samo jednu upitnu rečenicu, niti konačno sažimanje svih promptova.

## Vraćene konkretne CI provere

Aktivni `.github/workflows/ci-clean.yml` sada izvršava:

- Deno 2.5.6 `check` za task, worker i post-save Edge ulaze, sa `--no-config --no-lock --no-npm --no-remote`; setup action je pinovan na provereni upstream commit;
- sedam dodatnih postojećih dynamic taxonomy paketa: shadow, service handoff, existing identity recovery, direct reply, verified alias, turn feedback i shadow source; lokalno 114/114 PASS;
- novi SQL writer characterization paket, zajedno sa prethodnih šest PG regresija; lokalno 24/24 PASS.

Ostaju kompletan mobilni Jest, TypeScript, cela AI Node grupa i migration integrity/Python testovi. Novi source guard za CI ima 3/3 PASS. Ne menja se aplikacioni runtime ni produkcioni deploy proces.

### Šta je zaista upoređeno sa starim CI-jem

Istorijski ref: `456328d9b6de16b97c3b75a5fd620efc1d0224df`. `git ls-tree` popisuje 223 workflow fajla. **Sadržajno je ovde pročitano pet**, ne svih 223:

| Istorijski workflow | Trenutni dokaz / otvorena razlika |
| --- | --- |
| `ai-deno-contract-check.yml` | Deno import/type provera vraćena u aktivni workflow, dodat i post-save ulaz. |
| `worker-ai-cross-mode-source.yml` | Tri AI paketa obuhvaćena celim AI globom; pet dynamic paketa vraćeno eksplicitno. |
| `gemini-stream-safety.yml` | Relevantna dva Jest paketa ulaze u postojeće globalno Jest otkrivanje. Nije potrebno duplirati workflow. |
| `location-ai-geocode-regression.yml` | Relevantna tri Jest paketa obuhvaćena su globalnim Jest-om. Ovo nije live geocoder proba. |
| `taxonomy-postsave-binding-pg-proof.yml` | Pravi disposable PG16/17 i pun binder fixture nisu ekvivalentni sadašnjim minimalnim PGlite testovima. Ta provera ostaje otvorena. |

Preostalih 218 istorijskih workflow sadržaja ovim izveštajem nije proglašeno pregledanim. Nije urađen masovni povratak arhive niti zaključeno da su svi stari workflow-i potrebni.

## Precizne granice Deno i SQL dokaza

Lokalno je pokrenut isti Deno 2.5.6 check preko privremenog npm cache runtime-a, bez dodavanja zavisnosti u projekat. Sva tri ulaza prolaze. **Requester `index.ts` već ima `@ts-nocheck`**: uspeh ne znači da je svaki izraz u tom handleru tipski proveren. Check proverava import graf i typechecked delove; ne izvršava handler, model, DB ili mrežni zahtev aplikacije.

Supabase lokalni Edge server koristi sopstveni runtime; Deno check nije puna Edge-runtime kompatibilnost ili deployment proba. Reference: [Deno check](https://docs.deno.com/runtime/reference/cli/check/) i [Supabase development environment](https://supabase.com/docs/guides/functions/development-environment).

SQL characterization izvršava tačno sačuvane read-only live function bodies nad minimalnom sintetičkom bazom. Prolaz tih testova znači da je postojeće problematično ponašanje reprodukovano, **ne da su S08/S11/S12 popravljeni**. Nema testiranja kompletnog RLS/auth/signed Save/dispatch ugovora tim fixture-om.

Workflow bez secret/deploy naredbi nije isto što i potpuno bez mreže: setup i `npm ci` koriste mrežu. Source regex test takođe nije dokaz bezbednosti svakog tranzitivnog install skripta.

## Dodatni sadržaj koji je pročitan

Pročitani su Jest config/urgent setup, package/TS config, app/EAS config i build/native/asset pomoćni skriptovi zabeleženi hash-om u centralnom manifestu. Production target ima postojeći eksplicitni guard; nije rađen build ili release. `verify-native-patches --repo` pominje istorijski Android workflow: taj poseban režim i istorijska build pokrivenost ostaju za zasebnu proveru. Deno media runtime test pročitan je, nije ovde izvršen.

Razlika između FULL, PARTIAL i automatskog popisa ostaje u `01B_FILE_REVIEW_LEDGER.csv`. Pokretanje hiljada testova nije dokaz da je njihov svaki fajl sadržajno pročitan.

## Dalje

Završiti mapiranje drugih aktivnih pisaca i preostalih CI ugovora; zatim F1 corpus i najmanji dokazivi SQL/semantic ugovor. Durable classifier retry, životni vek background posla pre completion-a, konačno sažimanje promptova i stvarna p50/p95 merenja ostaju otvoreni. Bez posebnog odobrenja nema DEV deploy-a, live write testa ili stvarnih obaveštenja.
