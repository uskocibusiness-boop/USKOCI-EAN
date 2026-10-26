# USKOČI ČISTO — DEV Gemini smoke i trajni oporavak klasifikacije

**Presek:** 26.10.2026. GitHub: uskocibusiness-boop/USKOCI-EAN; baza: DEV leqcwgzvjsxugfgzdmth.
**Izvori:** živi SQL, cron, upisani redovi, Edge kod, originalni izveštaji i zaključci drugog četa.
**Status:** testni sistem u grani, ne tvrdi se da je realni Gemini test već pokrenut.

## Postojeće stvari koje NE SMEMO praviti iz početka

- Dva Gemini razgovora i odvojeni klasifikator već postoje.
- Provera revizije nacrta postoji: task draft revision + 2, worker context revision + 1; server proverava tačan revision.
- Potvrđeni klasifikacioni planovi imaju trajni private.work_taxonomy_review_outbox_v1 i dva odvojena koraka: COMMITTED i BOUND. Stari ili nepotvrđeni plan ne sme dati radniku uslugu ili poslati push.
- Post-save worker radi na DEV-u na minut; postoje lease, idempotentni request key, najviše pet pokušaja uz backoff za privremeni kvar.
- Poseban private.work_taxonomy_pending_reviews_v1 pamti potpisane ali nerazjašnjene preglede. Trigger i read-only reconciliation funkcija već postoje.

## Stvarno pronađene praznine

1. U shared/backgroundTaxonomyArchitect.mjs se drugi Gemini poziva jednom. HTTP 503, nepravilan odgovor ili JSON.parse greška bivaju uhvaćeni, a nedovršena usluga prelazi na generički NEEDS_CLARIFICATION. To je tehnički kvar, ne dokaz nejasne ljudske namere.
2. Post-save worker za confirmed review ne poziva Gemini ponovo. Postoji private.taxonomy_reconcile_pending_reviews_v1 za dopunu pending ledgera, ali njegov poziv nije deo Edge worker-a. Pending ledger nije isto što i automatski reclassification retry.
3. Pregled baze: 29 gotovih outbox redova COMMITTED/BOUND, tri izuzetka koji zahtevaju pregled i devet nerešenih potpisanih pregleda (tri zadatka, šest radnika). Deo čeka ljudsku potvrdu; ne klasifikovati sve kao sistemske greške.
4. Zeleni GitHub CI ne dokazuje sam kvalitet prirodnog razgovora, aplikaciju na telefonu, matching ili push na stvarni uređaj.

## Novi proverljivi alati

- scripts/uskoci-ai-dev-smoke.mjs: autentičan namenski DEV test nalog, najviše jedna naplativa poruka stvarnom Geminiju po pokretanju, vlasnički RPC readback. Ne poziva Save, Activate, Publish, Dispatch ili Push.
- scripts/uskoci-ai-dev-smoke.test.mjs: offline provere da je test zaključan za DEV, namenski nalog i eksplicitni ACK; SSE dekodiranje.
- supabase/proofs/ai/taxonomy_recovery_characterization.test.mjs: offline reprodukcija HTTP 503 i dokaz postojećeg retry protokola za POTVRĐENI outbox. Simulacija, nije stvarni provider test.
- supabase/proofs/ai/taxonomy_live_readonly.sql: read-only inventar stvarnih DB stanja, bez podataka i identiteta vlasnika.
- .github/workflows/ai-dev-smoke.yml: isključivo ručni workflow_dispatch sa unapred postavljenim GitHub Secrets. Na GitHub-u workflow_dispatch zahteva da je fajl raspoloživ na default grani; u međuvremenu isti skript može lokalno izvršiti vlasnik test okruženja.

## Pokretanje naplativog testa, bez objavljivanja

Obavezna četiri kredencijala u okruženju: USKOCI_DEV_SMOKE_EMAIL (lokalni deo sadrži uskoci-test), USKOCI_DEV_SMOKE_PASSWORD, USKOCI_DEV_SMOKE_ACCOUNT_ID i USKOCI_DEV_ANON_KEY (javna klijentska vrednost, ne service_role). Test nalog mora postojati, imati mogućnost razgovora i dovoljan AI test budžet.

Za svaki test osigurati:
- USKOCI_DEV_URL=https://leqcwgzvjsxugfgzdmth.supabase.co
- USKOCI_DEV_SMOKE_ACK=DEV_TEST_PAID_ONE_TURN_NO_PUBLISH
- USKOCI_DEV_SMOKE_KIND=NEED (ili WORKER)

Nakon bezbednog učitavanja kredencijala: node scripts/uskoci-ai-dev-smoke.mjs

Runner odbija da započne bez svih uslova. Ne ponavlja naplativ pokušaj. Kreira samo testnu konverzaciju i šalje jednu poruku, ne proizvodi objavu. Izlaz je kratka mašinska potvrda bez korisničkog teksta ili tokena. Nema opravdanja da se ovaj test koristi sa produkcionim ili pravim korisničkim nalogom.

## Dokazni koraci pre konačne arhitekture

**A (offline):** GitHub CI + sintetički/mock testovi + realni read-only SQL — ne dokazuje Google Gemini kvalitet.
**B (real DEV):** namenski korisnik, pravi Gemini HTTP, završni turn receipt i Supabase vlasnički readback; tek tada reći da je provider test prošao.
**C (signed Save):** pod istim namenskim korisnikom potvrditi radno područje Novi Sad + 30 km, signed save, category/mode/revision i ponovni readback. Ne dozvoliti novi mode bez čoveka.
**D (integracija):** u potpuno izolovanom test okruženju kontrolisano kreirati par radnik/zadatak, potvrditi matching, relevantna obaveštenja i bez dupliranja, bez slanja stvarnim korisnicima.
**E (telefon):** Android chat UX, mapa/pin, kartica tek kad je spremna, push i Dogovor.

## Ograničena sledeća popravka (NIJE implementirana)

Najpre utvrditi konačno odobrene izvore za prompt, revision i SQL. Zatim:
1. Razdvojiti privremeni kvar klasifikatora (429/5xx, timeout, malformed JSON) od stvarne semantičke dvosmislenosti. Ne postavljati korisniku lažno razjašnjavajuće pitanje. Svaki ponovni plaćeni poziv mora imati rezervaciju i obračun troška.
2. Veži samo potvrđeni worker/service/mode i task fingerprint uz tačnu reviziju, da kasna klasifikacija ne može nadjačati noviji pregled.
3. Proširiti postojeći pending ledger u stvarnu **durable reclassification** proceduru sa lease-om, next retry datumom, konačnim REVIEW_REQUIRED, ponovnim čitanjem potpisa i stanja. Ne uvoditi konkurentski drugi red bez opravdanja.
4. Prisilno testirati prekid nakon Save-a, ponovni cron pokušaj, stale revision, dvostruki klik Save-a, neuspešni Gemini JSON i ispravno ostavljanje otvorenog pitanja čoveku.
5. Ne pokretati matching ili push bez odobrenog signed binding-a.

**Nijedan od ovih novih arhitekturnih patch-eva nije automatski deployovan.** Ovim izveštajem je eksplicitno razdvojeno šta je već rešeno, šta je izmereno i šta tek treba odobriti/testirati.
