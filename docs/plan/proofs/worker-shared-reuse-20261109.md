# Worker: više izvornih usluga za istu postojeću sposobnost — 2026-11-09

Status: **SOURCE + izolovani SQL dokaz; DEV paket pripremljen, nije primenjen**. Polazni kod: `8f89568cd72b21c783feb58f8d240fe93d066387`.

## Kvar i najmanja povezana ispravka

Telefon je proizveo zasebne ponude „Kurirske dostave“ i „Nabavka i kupovina“ sa istim potvrđenim postojećim category ID-jem i režimom ON_SITE. Obe ponude su pojedinačno prolazile proveru. Resolver, exact/alias projekcija i batch writer odbijali su ponavljanje category ID + mode kroz različite nazive.

Kandidat menja samo te tri duplicate-target provere. Različiti normalizovani nazivi ostaju zasebne stavke u razgovoru, review-u, plans, rezultatu i sačuvanim skills. Nema preimenovanja/spajanja korisničkog teksta niti dodavanja globalnog sinonima. Izuzetak važi samo za WORKER_CAPABILITY i postojeći REUSE_EXISTING, istu kategoriju/mode i identičan originalni handoff. Svaki originalni naziv mora zasebno proći postojeću risk proveru; kategorija mora ostati validan bezbedan list. Dupli naziv, CREATE/EXTEND izuzetak, drugi vlasnik, promenjen digest, nepotvrđeni Save, novi mode i promenjen identitet ostaju odbijeni.

Postojeći binder je zadržan. On zasebno proverava svaki potpisani original, a zatim radi UPSERT pod jedinstvenim ključevima. Dve ponude tako ne proizvode dve fizičke capability/mode stavke. Nema novog normalizatora, heurističkog spajanja ni dodatnog AI poziva.

## Izvršeni dokazi

- `node --test scripts/worker-shared-reuse.test.cjs`: **9/9 PASS**, bez preskočenih testova, 20,75 s.
- Pozitivan tok izvršava stvarne uhvaćene SQL funkcije: source-bound worker session → turn hint → resolver → resolved view → candidate projection v2 → sintetički potpisan review/Save → batch → neizmenjeni binder.
- Svih šest konkretnih originalnih ponuda prolazi, sa pet jedinstvenih aktivnih category/mode veza. Kanonski naziv + registrovani alias takođe prolaze isti tok. Dve REMOTE ponude sa identičnim `{required:false}` zadržavaju obe stavke i jednu mode vezu.
- Negativne provere: isti/normalizovano isti naziv; NEED purpose; nedostajući/null/drugačiji handoff; prethodni EXTEND ili CREATE; pojedinačno široka/rizična usluga; grupni čvor; drugi vlasnik; nepostojeći Save; izmenjen signed plan; promenjena category identity; promenjen request replay.
- DDL restore/reapply zadržava stare receipt-e i vezane sposobnosti; novi resolver vraća staro ponašanje posle restore-a.
- Generator `node scripts/sql/worker_shared_reuse_20261109.build.cjs --check`: PASS.
- Paketni harness koristi isti renderer i atomske DO blokove sa izolovanim OID/ACL metapodacima i izričito sintetičkim closure hash funkcijama. Dokazuje odbijanje pogrešnog OID-a pre DDL-a, potpun rollback sva tri tela pri neuspehu završne provere, promotion → postflight → rollback → reapply i odbijanje ponovnog promotion-a bez očekivanog preimage-a. **Ne predstavlja DEV/RLS/closure-certification dokaz.**
- Read-only preflight na `leqcwgzvjsxugfgzdmth`: **WORKER_SHARED_REUSE_PREIMAGE_MATCH** za konačni paket. Provereni OID, tela, owner/ACL, security attrs, argumenti/defaults/result, language/kind/cost/rows/support, 11 relevantnih relation ACL/RLS/policy/constraint ugovora i closure stanje. Nije izvršen promotion.

## Closure i kontrolisana promocija

Batch writer je deo postojećeg closure source/erasure inventara. Zato promena njegovog tela menja izračunate digeste; ne pretvaramo to u novi sertifikat. `predict.sql` izvršava originalne žive digest izraze read-only i u računu zamenjuje samo tri ciljana MD5 tela. Originalni izrazi prvo reprodukuju zatečeno polazno stanje.

| Digest | Pre | Tačno predviđeno posle |
| --- | --- | --- |
| source | `753d79f470a01341046e53aa1846b6c314f059334627b0084dc96de67df93598` | `acf469c343e33c4126ca96853b4461c8dcdf7271cc22fb36464cc506006dd6ab` |
| erasure | `6c0005eb31003b4377ec468a77e246507fb92c5179ecf240d6359503b8a5df7d` | `24613a2985b790b6fa4445b021861a2bf25e7bb44d907da148900870bdccb11c` |

Stored source/erasure certificate ostaje `0201a7ccf74a3a5d0ed397d714392881af6ea1056b42f549097f9d3ecd9a4acb`, schema digest ostaje isti, `sourceReady=false` ostaje false. To **nije** uspešna R10 recertifikacija. Paket ne piše readiness, certificate, grants, owner, RLS niti korisničke podatke. Završna provera traži tačne predviđene digeste, ne samo bilo kakvu promenu.

Pripremljeni fajlovi uz prefiks `scripts/sql/worker_shared_reuse_20261109`: abort-guarded source kandidat, preimage, operation-preimage, deterministički build, manifest, read-only prediction, preflight, jedan atomski promotion, postflight i atomski rollback. Novi migracioni timestamp nije izmišljen. Za primenu su i dalje potrebni aktuelan puni CI i ponovni preflight; kanonski ledger/readback beleži izvršni agent tek posle stvarne kontrolisane primene.

## Otvoreno i granice

„Fizički poslovi“ ostaje NEEDS_CLARIFICATION. Ovaj kandidat ne nagađa šta to znači i ne pretvara široku ponudu u potvrđenu sposobnost. Postojeći uhvaćeni DEFERRED hint je idempotentan i ne prepisuje se: posle prenosa treba novi konkretan odgovor korisnika / novi turn i odgovarajući novi review, ne obećanje da će puko osvežavanje starog hint-a uspeti.

Potpisani review i Save u izolaciji su sintetički, bez stvarnog Auth/HTTP korisnika, mobilnog potvrđivanja, Edge provider poziva ili produkcije. Nova DEV primena, hosted postflight, stvarni Worker Save+Activate i matching ostaju nepotvrđeni ovim dokumentom. Puni closure inventory nije rekonstruisan u PGlite; zasebna read-only prognoza koristi stvarni DEV inventar. Postojeća ranija prava, namerno uklanjanje usluge i per-mode ograničenja ostaju pod istim binder ugovorom.
