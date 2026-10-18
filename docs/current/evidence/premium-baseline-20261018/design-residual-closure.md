# Premium White — preostali ograničeni paket

Datum: 18. 10. 2026. Polazni HEAD: 06104539. Ovo je nastavak postojećeg foundation paketa, a ne novi dizajn ili tvrdnja da je ceo repozitorijum očišćen.

## Provera vlasništva i upotrebe

Pre izmene je pretražen src za Pictogram, PickerTile i PickerGrid, bez testova. Stvarni uvozi su src/designLab/dizajn-tabla.tsx i unutrašnji PickerTile → Pictogram. TaskFace ima samo istorijski komentar. U ovom source scope-u nije pronađen produkcioni importer porodice; to nije dokaz analizom native bundle-a. Galerijska porodica ostaje dostupna, nije uklonjena.

## Fizičke promene i zamenske zaštite

| Fajlovi | Prethodno ograničenje / problem | Promena i sačuvana zaštita |
|---|---|---|
| src/theme/colorTokens.ts; src/ui/system/tokens.ts; src/ui/system/Pictogram.tsx | GREEN/ORANGE/MUTED su bile zasebne literalne palete u komponenti | Postojećih 15 identičnih vrednosti sada živi u colorTokens.illustration.pictogram; sys.pictogram je alias tog objekta. Nije uvedena nova screen paleta niti nasumično prebojen crtež. |
| scripts/design/generate-pictograms.cjs; scripts/design/pictograms.cjs | Regenerisanje je ponovo ispisivalo duplu literalnu paletu | Generator emituje sys.pictogram reference; mrtvi dupli TONES export uklonjen je iz podataka generatora. SVG crteži i katalog nisu promenjeni. |
| src/ui/system/__tests__/pictogram.test.tsx | Tačno 46 stavki, samo četiri grupe i literalna siva whitelist; fiksna visina samostalnog tile-a | Neprazan katalog, jedinstveni ključevi/gradient ID-jevi, poznata značenja i čitljive labele; dodatne grupe dozvoljene. Disabled gradijent čita centralni muted par. Tile čuva labelu, izabrano stanje i centralni minimum dodira. |
| src/ui/system/__tests__/motion-presets.test.ts | Tačan zatvoren skup šest kategorija | Poznati API ostaje dostupan; dodatne neprazne kategorije su dozvoljene. Postojeće provere granica trajanja, opruge, reduced motion i scoping-a petlje ostaju. |
| src/ui/system/__tests__/key-value-row.test.tsx | Labela je morala imati baš maxWidth 45% | Labela može da se skupi i zauzima pozitivan deo reda manji od cele širine; vrednost dobija prostor. Par ostaje pravilno izgovoren screen reader-u. |
| src/ui/system/__tests__/poruka.test.tsx | Obavezna bela kapsula, tačno 52 dp, 16 dp odmaci i tri reda | Poruka mora biti čitljiva, ograničene širine i iznad caller clearance-a; promena clearance-a zadržava relativni razmak. Overlay ne blokira ostatak ekrana. Akcija ima centralni minimum 48 dp. Postojeći oporavak, announcement, jednokratno izvršenje, timer i lifecycle provere ostaju. |
| src/ui/system/__tests__/segmented-modes.test.tsx | Fiksna granica četiri opcije; fixture se završavao na pet; dekorativna debljina underline-a i mera badge-a | Testira se stvarni izvezeni SEGMENTED_CHIPS_FROM, obe strane granice i katalog proizvoljne dužine. Izbor, labele, dostupnost svih opcija, touch target, scrolling, press delay, attention badge i caller stil ostaju provereni. |

## Dokaz

- Generator je izvršen: node scripts/design/generate-pictograms.cjs. Izmenio je samo predviđeni Pictogram output; pregled diff-a potvrđuje da su crteži nepromenjeni.
- Ciljana komanda: node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/ui/system/__tests__/pictogram.test.tsx src/ui/system/__tests__/motion-presets.test.ts src/ui/system/__tests__/key-value-row.test.tsx src/ui/system/__tests__/poruka.test.tsx src/ui/system/__tests__/segmented-modes.test.tsx
- Rezultat: 5 paketa, 77 testova PASS, 0 snapshot-a; 8,292 s.
- Log: work/premium-reset/design-residual-targeted.log.
- git diff --check za ovaj scope: PASS.

## Granice zaključka

Ovo zatvara navedene konkretne blokade. Mehanički registar nije proglašen potpuno ručno pregledanim. Poslovni podaci, produkciona navigacija, backend, AI pozivi i native build nisu menjani ili izvršavani u ovom paketu. Komponente KeyValueRow, Poruka i Segmented zadržavaju trenutni runtime izgled; test više ne pretvara navedene optičke vrednosti u trajnu zabranu evolucije. Zajedničku punu regresiju i APK vodi glavni agent nakon integracije.
