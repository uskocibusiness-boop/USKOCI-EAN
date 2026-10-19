# Prirodni nazivi, strukturne grane i nastavak potvrđenog plana

Povezana forward migracija: `supabase/migrations/20261019071732_taxonomy_natural_services_structural_paths.sql`, napravljena Supabase CLI komandom `migration new`. Paket menja šest postojećih funkcija. Ne menja podatke kataloga, pravila rizika, profile, consent, feature flags, outbox ili push redove prilikom primene.

## Obuhvat

1. `taxonomy_risk_triage_v1` prvo primenjuje postojeća uključena `BLOCKED` i `REVIEW_REQUIRED` pravila. Prirodna fraza više ne mora da počne jednom od 19 dozvoljenih radnji. „3D štampa“, „Časovi engleskog“ i „Šetnja pasa“ mogu biti kandidati. Nejasni pojedinačni pojmovi i generičke usluge i dalje traže pojašnjenje. Ova deterministička trijaža nije dokaz bezbednosti niti semantičke ispravnosti; ne zamenjuje modelsku safety proveru i pregled vlasnika.
2. `taxonomy_review_candidate_projection_v2` razlikuje organizacioni međučvor od precizne završne usluge. Svaki nivo prolazi bezbednosne i validacione provere; samo završna usluga mora biti `LOW_RISK_CANDIDATE`. „Digitalni zanati“ može biti organizacioni roditelj, ali sam po sebi nije nova kompetencija.
3. Uklonjena je fiksna granica šest nivoa u capture, projection, batch writer i kompatibilnom legacy prepare/commit putu. Ostaju granice veličine: capture 18 000 bajtova, batch/projection 16 000, legacy plan 12 000, postojeće granice broja ponuđenih usluga i dužine svakog naziva. Nije uvedena druga numerička granica dubine.
4. Novi čvorovi nastaju tek nakon stvarnog vlasničkog Save/Accept zapisa, iz neizmenjenog potpisanog pregleda. Batch writer dopušta isti potvrđeni plan posle nepovezane promene kataloga, ponovo proveravajući identitete, režime, potpisani roditeljski naziv i svaku koliziju. Ne menja stari review, fingerprint, verziju plana ili značenje; relevantna promena vraća `PT409`. Pre-Save stale zaštita ostaje ista.
5. Capture ne sme pozajmiti novije stanje razgovora starom uspešnom potezu. Worker se vezuje za `source_revision + 1`, stvarni completion hash i neopozvan potez, uz session lock. Task zahteva vlasnički authoritative receipt, njegovu poslednju assistant poruku, odsustvo novijeg završenog/aktivnog poteza i conversation lock. Sve ranije role/owner/attempt i replay provere ostaju.

## Izolovani dokaz

Workflow `.github/workflows/taxonomy-new-branch-scopes-pg-proof.yml`, job `natural-service-branching`, PostgreSQL 16 i 17:

```sh
root=supabase/proofs/dynamic_taxonomy/branching-natural-depth
psql -X -v ON_ERROR_STOP=1 -f "$root/fixture.sql"
psql -X -v ON_ERROR_STOP=1 -f "$root/assert-before.sql"
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261019071732_taxonomy_natural_services_structural_paths.sql
psql -X -v ON_ERROR_STOP=1 -f "$root/assert.sql"
psql -X -v ON_ERROR_STOP=1 -f "$root/revert.sql"
psql -X -v ON_ERROR_STOP=1 -f "$root/assert-before.sql"
psql -X -v ON_ERROR_STOP=1 -f supabase/migrations/20261019071732_taxonomy_natural_services_structural_paths.sql
psql -X -v ON_ERROR_STOP=1 -f "$root/assert.sql"
```

`assert-before.sql` treba da PROĐE: reprodukuje stara ograničenja i prihvatanje zastarelog capture-a. `assert.sql` proverava ispravke. Oba se završavaju rollback-om svojih sintetičkih podataka. `before.sql` i `before-metadata.json` sadrže stvarno pročitane prethodnike, a migracija odbija neočekivani MD5, owner, ACL ili search_path. Rollback vraća šest tačnih prethodnika; reapplication prolazi iste preduslove.

Dokaz pokriva:

- osam novih nivoa, novi koren ili postojeći roditelj, oba eksplicitno pregledana režima u oba redosleda;
- stvarni capture → projection → batch → worker binder i need binder, isti završni UUID;
- bez Save nema commit-a; nema roditeljskih/srodnih kompetencija, implicitnog drugog režima, dispatch-a ili push autoriteta;
- bezbednosna pravila za završni i međučvor, nejasan leaf, loš JSON node, vlasnik, potpis, stara revizija, ciklična/ponovljena putanja i atomarni rollback;
- nepovezana promena kataloga nakon Save uspeva; preimenovan roditelj i sukob canonical/alias značenja ne uspevaju;
- legacy prepare/approve/commit zadržava Save i zasebno naknadno vezivanje;
- zastareli worker i task capture se odbijaju; tačan aktuelni completion i idempotentni replay prolaze; opoziv, pogrešan vlasnik poruke i aktivan sledeći potez se odbijaju;
- originalni owner/ACL/search_path/security i redovi safety pravila ostaju isti.

## Granice dokaza i integracije

Fixture koristi postojeći izolovani skup tabela. Review/Save redovi su sintetički, kao i Need source hash; ovo nije dokaz native Save komande, celog razgovora ili produkcionog izvora svih task činjenica. Capture predikati, klasifikaciona projekcija, admission, batch i binders izvršavaju stvarne SQL funkcije. Sve koristi samo sintetičke UUID/nazive; nema korisničkih razgovora.

Lokalno nema PostgreSQL/Docker izvršnog okruženja. Paket predat na CI nije automatski dokaz da je SQL prošao ili da je primenjen. Rezultate PG 16/17, readback primene i native tok beleži glavni agent nakon integracije.

Root zasebno usklađuje Edge katalog bez limita 96 i dva klijentska parsera koja su odbijala `path.length > 6`. Ovaj SQL paket ne rešava te parsere. Legacy pojedinačni admission i dalje zadržava svoj strogi globalni stale protokol; olakšani bezbedan nastavak primenjen je samo na aktivni, sačuvani reviewed batch. Novi sopstveni kriterijum značenja, automatski alias ili nova kompetencija nisu dodati.

Need completion trenutno nema trajni hash svih činjenica posle završetka. Ovaj paket zatvara reprodukovani kasni capture između AI poteza pomoću trajnog receipt/message dokaza, ne tvrdi da receipt sadrži reviziju svakog mogućeg naknadnog uređivanja činjenica. Potpisani pregled i postojeći source fingerprint ostaju neophodni za nastavak.
