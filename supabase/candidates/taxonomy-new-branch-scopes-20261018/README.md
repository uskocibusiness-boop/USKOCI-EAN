# Nova grana: tačan roditelj i dva eksplicitna režima

Status: FORWARD CANDIDATE, nije primenjeno. Izvor je trenutni DEV od 18.10.2026; root primenjuje posle stvarnog PostgreSQL dokaza.

## Dva potvrđena problema

1. `taxonomy_review_candidate_projection_v2` proverava CREATE_CHILD roditelja obrascem **8-4-4-12**, umesto standardnih **8-4-4-4-12** UUID grupa. Svaki stvarni UUID roditelja zato ostaje PENDING_CLASSIFICATION. Read-only izvršenje stvarnog obrasca vraća false za ispravan UUID; prethodni create-child v2 kandidat imao je ispravan obrazac. Regresija je u primenjenom root-branch v3 paketu.
2. Nova usluga u oba eksplicitna režima dobije dva potpisana CREATE_NEW_BRANCH plana. Writer napravi čvorove za prvi režim, zatim odbije isti čvor za drugi: BATCH_SEMANTIC_OR_MODE_COLLISION. Cela transakcija se ispravno vraća, ali korisnik ostaje bez nove kategorije. Isti problem se javlja za CREATE_CHILD posle popravke roditeljskog UUID-a.

## Minimalna izmena

- Projection dobija samo nedostajuću UUID grupu. Pravila identiteta, parent moda, vlasnika, izvora, kataloga i rizika ostaju ista.
- Writer pamti ID-eve čvorova koje je upravo napravio u toj transakciji. Samo takvom čvoru, na istom mestu u stablu, drugi eksplicitno potpisani plan može dodati svoj režim. Starim kategorijama se režimi ne proširuju.
- Jedan leaf UUID ostaje zajednički za oba režima. Kompetencija se i dalje upisuje tek nezavisnim binderom, iz potpisanog Save-a, isključivo za leaf uslugu; roditelj i srodne grane ne daju sposobnost.
- Broj novih čvorova i catalogVersion nastavljaju da se povećavaju po novom čvoru. Oba režima nastaju u istoj atomskoj transakciji; nema vidljivog međustanja ni drugog spoljnog upisa.
- Nema poslovnih upisa, nove kategorije, promene gate-a, model poziva ili obaveštenja tokom primene candidate.sql.

## Šta je zaista aktivno na DEV

Outbox, binding, pending i strict-scope kontrole su true. Legacy `auto_registration_enabled=false` isključuje stari nepregledani upis i ne blokira signed batch writer. Postsave Edge v4 radi: 60 HTTP 200 `CATALOG_AND_BINDING_TICK` odgovora u posmatranom satu. Šest stvarnih outbox stavki su COMMITTED/BOUND, ali svih šest su REUSE_EXISTING; nisu dokaz nove grane.

Aktuelni tok: Gemini predlog → trenutni hint vezan za vlasnika/razgovor/izvor → potpisani pregled → korisnikov Save/Accept → outbox → atomski katalog commit → poseban worker/need binder. Postsave worker ne šalje novi Gemini poziv i ne rešava sam REVIEW_REQUIRED.

## Namerna ograničenja koja ovaj paket ne menja

- Najviše šest novih nivoa po predlogu. Roditelj može već biti duboko u stablu; to nije ukupni limit dubine.
- Samo registrovan alias i tačan canonical identity smeju da koriste postojeći ID.
- Nepotvrđen mode, pogrešan roditelj, nepostojeći/stari hint, promenjen katalog, povučen profil ili noviji Save zahtevaju novo važeće razrešenje.
- Rizik-triage i dalje koristi 19 dozvoljenih početnih radnji i dva skupa safety pravila. Nepoznata radnja može ostati NEEDS_CLARIFICATION.
- Projection traži LOW_RISK_CANDIDATE i za međunivo: npr. strukturno „Digitalni zanati“ ostaje unresolved, dok „Izrada modela“ prolazi. Writer je za međunivo manje restriktivan. To je zaseban problem politike naziva; ovde se ne popušta zaštita niti se izmišlja nova grana.
- Postojeća kategorija u jednom režimu ne dobija drugi režim samo zato što ga novi model predlaže. Potreban je zaseban pregled proširenja postojećeg kataloga.
- Pending/review-required stavke nemaju autonomni Gemini replan. Zato se ne tvrdi da sistem sam razrešava svaki nepoznat pojam.

## Izolovani dokaz

`fixture.sql` koristi postojeći katalog/owner fixture i tačne sadašnje definicije projection-a, batch writer-a, worker i need bindera, normalizatora, rizik-triage, fingerprint-a i scope mapiranja. Sintetički hint, potpisani envelope i Save zapis su eksplicitna fixture granica: ovo nije stvarni Auth/APK/Gemini test. Katalog i binder upisi su stvarni SQL u disposable bazi.

`assert-before.sql`: validan CREATE_CHILD roditelj ostaje pending; dual-mode nova root grana pada i ne ostavlja delimične čvorove.

`assert.sql`: CREATE_CHILD i CREATE_NEW_BRANCH, oba redosleda režima, šest novih nivoa, jedan leaf ID, worker binding u dva režima, requester binding istog ID-a u oba režima, bez roditeljske/srodne kompetencije, replay, stara single-mode međugrana se ne proširuje, nedostajući parent scope ostaje pending, jedan potpisani mode ne daje drugi, tamper odbijen, safety i politika međunivoa očuvani.

Redosled: source.test.mjs → fixture.sql → assert-before.sql → candidate.sql → assert.sql → assert-metadata.sql → revert.sql → assert-before.sql → candidate.sql → assert.sql → assert-metadata.sql.

Tačna predecessor MD5 i ACL su u manifest.json. Revert odbija nepoznat post-state. Oba target naziva nisu direktno navedena u trenutnom closure source/program roster-u; root ipak poredi stvarne pre/post digeste i ne menja postojeći certifikat.

Preostali dokaz posle isporuke: stvarni AI razgovor o stvarno novoj usluzi, pregled plana, Save/Accept, konačni katalog ID i binder receipt. Nijedan takav živi scenario nije izvršen ovim paketom.
