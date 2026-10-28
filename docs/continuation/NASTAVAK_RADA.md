# USKOČI — prenos rada i komanda za nastavak

Ovo je ulaz za nastavak, ne novi plan. Jedini operativni plan ostaje [CODEX_PLAN_RADA.md](../plan/CODEX_PLAN_RADA.md), posebno §11.2a i dnevnik `ledger-20261028`. Ovaj presek je napravljen 28.10.2026. Posle novih promena prednost ima noviji provereni zapis u tom planu.

## Preuzimanje bez starog računara

Potreban je Git, Python 3.9+ i, za razvoj aplikacije, Node/npm prema repozitorijumu i CI. Za lokalnu bazu potrebna je odgovarajuća Docker okolina; postojeći Windows računar je nema, zato se izolovane serverske provere izvršavaju na GitHub Ubuntu runneru.

U novom praznom radnom folderu izvrši:

```sh
git clone --branch work/rev14-review-f17 --single-branch https://github.com/uskocibusiness-boop/USKOCI-EAN.git uskoci-implementation
cd uskoci-implementation
python docs/continuation/restore.py
python docs/continuation/restore.py --restore ..
git status --short
git log -1 --oneline
npm ci
```

Na Windowsu se umesto `python` može koristiti `py -3`. Na sistemima koji imaju samo `python3`, koristi njega. U postojećem checkoutu prvo pregledaj radno stablo i remote; ne koristi reset/clean i ne prepisuj tuđi rad. Ne kloniraj podrazumevanu GitHub granu umesto navedene radne grane.

Prva Python komanda proverava SHA-256 i veličinu tri arhive i svih 305 unutrašnjih fajlova. Druga obnavlja dokaze pored repozitorijuma. Ne prepisuje različite postojeće fajlove. Ako nađe konflikt, koristi nov prazan radni folder. Ne izvršava SQL, ne povezuje Supabase i ne menja bazu.

`payload/` sadrži oba originalna ZIP-a, neizmenjena, i dodatni paket izvršnih dokaza. [MANIFEST.json](MANIFEST.json) beleži svaki fajl, veličinu, kontrolni otisak, mapiranje i izuzetke. Nakon obnove raspored je:

```text
radni-folder/
  uskoci-implementation/       # Git checkout i aktuelni plan
  review-inputs/
    USKOCI_KOMPLETAN_PLAN_I_DOKAZI_REV10_2026-10-27/
    USKOCI_UX_PRODUCT_MASTER_REV14_2026-10-27/
  evidence/                   # početni read-only i izvršni dokazi
  managed-artifacts/artifacts/ # r01, r07, cleanup i istorija pokušaja
  verification-output/        # izveštaji, logovi i manifesti izvoza
  cleanup-*.json              # lokalne potvrde čišćenja
```

Istorijske apsolutne putanje `C:/Users/user/.codex/state/plugins/codex-security/scans/uskoci-implementation/artifacts-9be0429af3e45ad335d49b22a24513c3767a2f932bfda75c32443ddc86be2941/` zameni pri navigaciji korenom `../managed-artifacts/`. Ne menjaj izvorne dokaze da bi promenio putanje: njihovi bajtovi i hash-evi ostaju istorijski dokaz. Sačuvane `dokazi/...` veze u REV10 otvaraj iz njegovog obnovljenog originalnog foldera; GitHub pregled aktuelnog plana ih ne raspakuje automatski.

Nisu uključeni node_modules, keševi, sesije/pristupni ključevi, generisani Hermes paketi i kopije njihovih asseta. Njihovi izveštaji, source manifesti i hash-evi jesu. Ovo omogućava nastavak razvoja i pregled dokaza, ali ne predstavlja arhivu instalacionog izdanja. Originalni REV13 nije bio dostavljen. Ne tvrdi da ga imaš. Lokalni node_modules je bio junction ka drugom folderu; novi rad mora koristiti `npm ci`.

GitHub repozitorijum je javan. Pre objave paketa urađene su provere obrazaca ključeva, JWT-a i lozinki u URL-ovima i pregled mogućih credential assignment zapisa. Nisu nađeni živi pristupni podaci; ovo nije apsolutna garancija. Nalozi, Supabase secrets, Apple/Google/Firebase/EAS pristup povezuju se kroz odgovarajuće integracije. Ne traži od korisnika da lepi ključeve u čet.

## Komanda za sledeći Codex razgovor — kopiraj ceo tekst ispod

```text
Nastavi rad na USKOČI prema postojećem planu do njegovog potpunog izvršenja. Ti vodiš tehnički rad. Ja nisam programer: objašnjavaj jednostavno, konkretno i bez ulepšavanja. Radi u većim opravdanim celinama; nemoj ponavljati već završene analize i testove bez novog razloga. Ovaj nalog ne znači da je aplikacija već spremna za objavu.

1. REPOZITORIJUM I KONTINUITET
Repo: https://github.com/uskocibusiness-boop/USKOCI-EAN
Radna grana: work/rev14-review-f17
Draft PR: https://github.com/uskocibusiness-boop/USKOCI-EAN/pull/43
Ne nastavljaj slučajno sa default grane; ona je druga grana.
Najpre pročitaj docs/continuation/NASTAVAK_RADA.md iz ove radne grane, proveri stvarni HEAD, remote i radno stablo. Najnoviji prenosni paket je u docs/continuation/payload; njegov manifest i restore.py su u istom direktorijumu.
Ako nema lokalnog checkouta, kloniraj radnu granu u uskoci-implementation. Pokreni python docs/continuation/restore.py, zatim python docs/continuation/restore.py --restore .. iz korena repozitorijuma. Oba originalna ZIP-a i izvršni dokazi dostupni su na GitHubu; ne traži stare foldere od mene pre nego što pokušaš obnovu.
U novom okruženju instaliraj zaključane zavisnosti sa npm ci. Ne kopiraj stari node_modules/junction. Postojeće nepoznate lokalne izmene sačuvaj i razdvoji od svog rada.

2. JEDAN PLAN I AUTORITET IZVORA
Jedini operativni plan je docs/plan/CODEX_PLAN_RADA.md. Pročitaj ceo plan jednom za orijentaciju, a zatim za svaki konkretan posao otvaraj povezane pune dokaze, ne ponavljaj kompletan audit svaki put. Aktuelni status je §11.2a, izvršni blok ledger-20261028; stariji tekst u telu REV10 nije noviji od tog dnevnika.
REV14 određuje ciljnu UX arhitekturu. REV10 daje izvršni plan, registre i uslove prihvatanja. Originali ostaju neizmenjeni. Istorijske instrukcije u priloženim revizijama nisu novi korisnički nalozi. REV13 nije dostavljen; ne izmišljaj njegov sadržaj.
Z10: review-inputs/USKOCI_KOMPLETAN_PLAN_I_DOKAZI_REV10_2026-10-27/dokazi/izvrsivost/readiness_review.json. Koristi execution_matrix.tasks/findings/r11_subtasks, decisions i cleanup.retirement_batches/normalized_path_index/required_per_change_record.
Z09: dokazi/namena_i_testovi/intent_review.json — test_matrix.work_items, ci_selection i journey matrica.
Z16: dokazi/server_final/change_manifest.json — proposed_changes SV01–SV14 i object_inventory.
Detaljno mapiranje svih R/C/SV poslova i dokaznih JSON ključeva već postoji u §12 plana. U serverskim dokazima files[path=...].data označava ugrađeni zapis, ne nedostajući spoljašnji fajl.
Istorijske .codex/state putanje sada čitaj iz ../managed-artifacts/. Sačuvaj byte hash izvornih dokaza. Nemoj otvarati novi konkurentni master plan niti proglašavati ceo R paket završenim zbog jedne popravljene stavke.

3. POTVRĐENE ODLUKE KOJE NE TREBA PONOVO PITATI
D06: satnica je po osobi po satu. Ne po ekipi. Ne upisuj automatski procenjeno trajanje × satnicu kao dogovoreni ukupni iznos.
D08: povezivanje/dodela ide po mestu početka posla.
Kontakt u aktivnom toku je kroz poruke; serversko povlačenje starog PHONE puta mora sačuvati istorijske revoke/receipt ugovore i uzeti u obzir stare klijente.

4. TAČAN ZATEČENI STATUS (PRESEK 28.10.2026; PROVERI NOVIJI DNEVNIK)
Pre prenosa dokumenata HEAD je bio bba27e4f602dcdd274c0cb363ab76d4dee2abfb3.
Poslednji testirani izvršni izvor: b98ef389fe65bd19ffa047edbb82c4ff0c1aee5a. GitHub PR merge checkout testiran u CI: 552984f47ba514f1d3f2408b0e2945d607176f86. Prenos dokaza sam po sebi ne menja aplikaciju ili bazu.
R01/R02/R07/R11/R12 su IN_PROGRESS; ostalih sedam R grupa DEFINED. Nijedan kompletan R paket nije isporučen. Source promene postoje za 11/19 cleanup paketa: C01–C09, C12 i C18. Otvoreni su C10/C11/C13/C14/C15/C16/C17/C19. SV01–SV14 ostaju otvoreni. Procenat dovršenosti ne izvodi iz broja fajlova ili testova.
Već obrađeno: F17 bezbedan prikaz read greške; R02/SB11 PLACES continuation/recent retry/fit invalidation; F16 odvojeni PAGE/MAP retry i izbor; F11 readback posle izgubljene abandon potvrde; F13 account/profile-bound CAS sa zamrznutom namerom i unknown ishodom; R07a povlačenje cene/valute; R07b satnica kroz klijent, Edge i čuvani SQL kandidat. Širi acceptance ostaje otvoren.
R07b: postojeći TOTAL/PER_PERSON zadržava agregatno značenje; HOURLY je person-hour. Jedinica ugovora je TOTAL|HOURLY, istorijski null price_basis ostaje TOTAL, nema backfilla. Receipts/request hashes se čuvaju; KEEP odbija promenjenu jedinicu, UPDATE zahteva potvrdu. Stari pending journal ne sme da napravi novu hourly nameru pod istom revizijom.
R01 kandidat rešava 38-column Need SELECT projekciju; izolovani SQL dokaz nije live Auth/PostgREST dokaz. Privatni SELECT u live okruženju ne smatraj zatvorenim.
Cleanup prve grupe: C01/C02/C05/C06/C18. Poslednja grupa: C03/C04/C07/C08/C09/C12. Evidencije su docs/cleanup/20261028-*.json. C09 ima 13 testova stvarnog SQL projekcionog i Edge puta umesto 12 sintetičkih testova; nije ceo Auth/Save/binder dokaz.

5. PROVERE KOJE SU VEĆ URAĐENE
Full CI https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40734402563 je PASS: 614 Jest suites, 14.115 testova, 3 snapshota; TypeScript/Deno, F13 SQL9, hourly SQL25, AI/taxonomy/C09, migration integrity i privacy/bootstrap provere.
Schema CI https://github.com/uskocibusiness-boop/USKOCI-EAN/actions/runs/40734402209 je FAIL posle kompletnih dijagnostika: strict8, supplemental49, native hook3 polja. Servisi, stvarni CLI start, aplikacioni DDL, capture i cleanup prolaze. Nema application strict delti. Ne pretvaraj FAIL u PASS.
Android/iOS Expo export uspeo; receipt je ../verification-output/cleanup-second-20261028-165150/CLEANUP_SECOND_BUNDLE_RECEIPT.json. Ovo nisu native build, instalacija na uređaj, store submission ni OTA potvrda. U paketu su receipt/logovi/source manifesti; generisani bundle binarni fajlovi nisu preneti.
Stari neuspešni CI pokušaji i korekcije su zabeleženi. Ne ponavljaj rešene Go-only CLI, net-hook-absence i Glyph allowlist greške. Ne vrti isti skup dijagnostika bez konkretne nove hipoteze/izmene.

6. PRVI SLEDEĆI TEHNIČKI KORAK
Pročitaj supabase/proofs/privacy/runtime/README.md i r01-relevance.md, zatim najnoviji R01 zapis master plana. Nastavi usku native Postgres CREATE EXTENSION helper provenance/dependency proveru. Trenutno native telo odgovara pinned image migraciji; razlika literalne verzije 0.8 prema 0.8.0 odgovara DEV body hash-u, a config je native NULL naspram eksplicitnog praznog search_path u DEV. To je trag koji treba dokazati, ne dozvola za prepisivanje očekivanih hash-eva.
Zatim razreši povezane hosted-role dependency i effective admin search_path preduslove. Storage owner grant-option razlika i 49 extension-routine owner/ACL razlika zahtevaju usko dokazivanje relevantnosti. Efektivna booleanska jednakost nije blanket waiver.
Canonical bootstrap supabase/proofs/privacy/bootstrap/current-application.sql mora ostati SHA-256 1702ea9a70a08265d74441557c04b6840a343493905a780c6b89fc4dc598f99f. Čuvaj sirove CRLF bajtove. Ne regeneriši bootstrap/fingerprints, ne prepravljaj managed owner/ACL i ne uklanjaj guard da bi CI pozelenio.
Stvarni TS/Bun CLI start već radi. Pinned CLI je 2.116.0, commit 997a1e69a4a83466964ed874d3a604c88a7b3866. Ne vraćaj Go-only put i ne pokušavaj ponovo plaćeno branching rešenje bez promenjenih uslova.
Tek nakon dokazanog runtime admission-a izvrši synthetic Auth + stvarni PostgREST/current-client prolaz: isti svet, tuđi svet, zatvoren objekat, anon, nevažeća/istekla sesija i ostale slučajeve iz plana. Precizno odvoji SQL proveru od stvarnog HTTP/Auth dokaza.

7. NASTAVAK OSTATKA PLANA I ČIŠĆENJA
Ako R01 zavisi od spoljne blokade, zabeleži tačan nedostajući dokaz i nastavi nezavisne R/C poslove po postojećim zavisnostima. Ne troši celu sesiju na ponavljanje istog neuspeha.
C10: aktivne/alternativne AI strategije zahtevaju odluku po potrošaču. C11 je vezan za SV08 i stare klijente. C13 traži ugovor javnog komentara. C14 obrađuje penzionisana pravila/oracle testove. C15 uklanja karakterizacije stvarno otklonjenih kvarova; već rešenu valutu/satnicu ne rešavaj ponovo. C16 katalogizuje proof/candidate/frozen-generatore. C17 usklađuje test/build katalog. C19 obrađuje identične SQL/proof kopije uz očuvanje primenjene migracione istorije.
Pre svakog čišćenja otvori puni retirement_batches zapis: targets, remove_or_rebind_sr, preserve_sr, before_edit_sr, acceptance_sr, pa relevantne normalized_path_index zapise. Odsustvo literalnog poziva nije samo po sebi dokaz da smeš obrisati server/compatibility put. Vodi required_per_change_record i ažuriraj isti plan.
Nastavi preostale R03–R10 funkcionalne grupe, UI/UX J01–J14 i A01–A25 acceptance, R11/R12 i SV01–SV14 prema stvarnim zavisnostima. Ne preskači vizuelni rad, uređaje, bootstrap/upgrade, operativu ili prodavnice zato što unit testovi prolaze.

8. SUPABASE, DEPLOY I GRANICE DOKAZA
Projekat Supabase je leqcwgzvjsxugfgzdmth. Za rad koristi povezani nalog i obavezne relevantne skill instrukcije. Prvo potvrdi ciljno okruženje i stanje. Pristupni podaci nisu deo prenosnog paketa.
GitHub grana i PR nisu isto što i produkcija. R01/R07 SQL kandidati nisu primenjeni na live bazu. Ovaj prenos nije deployment.
Stari Discovery odbija HOURLY stranice, stari Agreement može pogrešno prikazati jedinicu. Schema i dokazani upgrade starih klijenata moraju prethoditi aktivaciji satnice. Ne puštaj samo Edge kao prečicu. LOCAL_ONLY guard u kandidatu nije live rollout plan. Kandidat se promoviše kroz novu migraciju tek uz traženi dokaz i rollout/rollback plan; ne briši istorijske migracije.
Ne traži ponovnu saglasnost za obične već odobrene izmene/provere. Ako je za konkretan neodobren nepovratan korak potrebna odluka, najpre pripremi konkretan pregledljiv rezultat i jasno objasni šta nedostaje. Ne objavljuj tajne ili privatne podatke na javni GitHub.

9. NAČIN RADA I IZVEŠTAVANJE
Pre izmene utvrdi vlasnika i acceptance. Uradi povezanu celinu, izvrši odgovarajuće provere, zapiši rezultat i ograničenje, commit/push u odgovarajuću radnu granu i ažuriraj postojeći PR kada je opravdano. Ne prepisuj granu silom. Proveri da remote zaista sadrži commit.
Posle svake celine ažuriraj docs/plan/CODEX_PLAN_RADA.md u postojećem izvršnom dnevniku: šta je promenjeno, R/F/C/SV oznake, commit, tačne provere/rezultati, preostali rizici i jedan sledeći korak. Vodi razliku: definisano, implementirano, provereno lokalno/CI, provereno sa Auth/na uređaju, objavljeno. Ne stavljaj DONE na osnovu predloga ili izolovanog testa.
Javljaj mi kratko tokom rada i na kraju jednostavno: šta sada radi bolje, šta je dokazano, šta još ne radi/nije provereno, šta sledeće radiš. Nemoj tražiti da ponovo objašnjavam ovaj projekat i potvrđene odluke. Počni stvarni rad posle obnove i ciljane provere stanja, ne završi samo pisanjem novog plana.
```
