# R04/R08 — odbijanje duplih mode deklaracija i jedan parser

Datum: 03.11.2026. Bazni source: `06d6dd637b3190d3643032dd17a7b3d4f429854f`.
Status ovog paketa: **LOCAL PATCH / TESTED IN ISOLATION / NOT COMMITTED / NOT DEPLOYED**.
Ovo je dokaz uz postojeći CODEX master, ne novi plan.

## Stvarni kvar i izmena

`workerModeRequests` je prepoznao duplikat tek pošto oba reda prođu proveru.
Kombinacija ispravnog i neispravnog reda za istu uslugu zadržavala je ispravan
red; isti par sa dva ispravna reda bio je odbijen. Time je dvosmislena AI
promena mogla da prođe proveru predloga načina rada ili fizičke predaje.
To nije dokaz da se na DEV-u već desio neovlašćen Save/Activate.

`inspectWorkerModeRequests` sada jednom parsira ograničen JSON i vraća
prihvaćene zahteve i identitete odbijenih deklaracija. Duplikat se prepoznaje
pre provere pojedinačnog reda i ostaje odbijen i posle trećeg pojavljivanja.
Aktivni single-pass builder koristi taj rezultat; uklonjeno je njegovo drugo
JSON parsiranje i zasebno računanje odbijenih deklaracija. Postojeći
`workerModeRequests` Map API ostaje kompatibilan za preservation/recovery.
Ne menjaju se prompt, broj modelskih poziva, katalog, SQL, signed review ili Save.

Prazan/odsutan opcioni podatak zadržava prethodnu kompatibilnost. Neispravan
celokupan JSON, preko 12 redova ili preko 12288 UTF-8 bajtova ne postaje
„nema izmene“: aktivni builder zadržava nerešen ishod. Odbijanje prevelikog
celog ulaza je namerno konzervativno i ne menja prethodno sačuvane DB podatke.
Neispravan red za jednu ponuđenu uslugu ne uklanja druge ponuđene usluge.

## Izvršeno

Četiri potpuna source modula rekonstruisana su iz GitHub očitavanja na
navedenom SHA-u i byte-identitet potvrđen Git blob SHA-1 vrednostima. Naknadno
je preuzet već postojeći source artifact 13232919650 iz run-a 41643329565;
provereni su ZIP SHA-256, unutrašnji tar SHA-256 i git-archive commit identitet.
Patch je zatim primenjen i na taj stvarni source, uključujući ceo CODEX master.
Nema zamenskih implementacija normalizatora, handoff dekodera, catalog gate-a
ili worker builder-a. Poruke, katalog i sačuvani profili u testovima su sintetički.

Isti novi testni fajl:
- pre ispravke: 42 testa, 19 PASS, 23 FAIL, 0 SKIP;
- posle ispravke: **42 PASS, 0 FAIL, 0 SKIP**;
- Node.js v22.16.0; `node --check` za sva četiri modula i novi test prolazi.

Na stvarnom source artifact-u izvršeno je i šest postojećih susednih testnih
fajlova: background_taxonomy_failures, background_taxonomy_scope,
background_worker_reuse, single_pass_continuity, service-handoff i
worker-existing-identity-recovery. Pre ispravke 145/145 PASS; posle ispravke
zajedno sa novim testovima **187 PASS / 0 FAIL / 0 SKIP**. Nisu menjana njihova
očekivanja. Ovo nije puni GitHub CI niti SQL/native prihvat.

23 neuspešna testa su različiti ulazi/posledice istog uskog kvara, ne 23
odvojena produkciona kvara. Pokriveni su redosledi duplikata, nevažeći citati,
ASSISTANT naspram USER teksta, oba pisma, treći duplikat, oba načina rada,
iste kategorije, namerno uklanjanje usluge, draft zamena, fizička predaja,
celovitost BOTH predloga i očuvanje nepovezanih usluga.

Komanda u punom checkout-u:

```sh
node --test --test-reporter=spec supabase/proofs/ai/worker_mode_declarations.test.mjs
```

Fajl je u postojećem `supabase/proofs/ai/*.test.mjs` CI glob-u; ne uvodi novi
workflow, framework ili zavisnost. Sama uključenost u glob nije izvršen CI.

## Granica dokaza i nastavak

Nisu izvršeni puni postojeći AI/mobilni skup, Deno/TypeScript handler provera,
GitHub CI za ovaj patch, SQL/Auth/PostgREST, novi model, DEV deploy ili Android/E2E.
Postojeći compatibility/preservation putevi nisu obrisani na osnovu imena.
C10 nije u celosti zatvoren; R04/R08 nisu DONE.

Pre slanja: proveriti tadašnji HEAD i relevantne postojeće handler/continuity
provere u punom checkout-u. Pre primene na DEV: usaglašen Edge paket,
preflight/readback i odgovarajući prihvat. Ne prepisivati istorijske delivery
hash-eve niti predstavljati raniji zeleni CI kao dokaz ovog patch-a.
