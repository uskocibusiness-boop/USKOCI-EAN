# Premium White: zatvaranje pregledanih ograničenja dizajna

Datum: 18. 10. 2026. Početni HEAD: eaa38a04e20be24bba71840660493b634180ee72. Rad je počeo nakon verifikacije baseline-manifest.json (6465 sačuvanih fajlova).

## Granice ovog paketa

Ovo je zapis konkretno pregledanih i promenjenih zaštita. Nije tvrdnja da je svaka stavka mehaničkog registra ručno pregledana, niti da je redizajn svih ekrana završen. Prethodno pripremljeni Surface i motion foundation su zadržani i provereni; nema paralelnog token/motion sistema. Nema backend, Supabase, build, commit ili deploy radnji ovog agenta.

## Stvarne promene u izvršavanju

- **Jedan izvor boja:** src/theme/colorTokens.ts je pure owner. sys.color/status/conversation/map/art čitaju isti izvor; theme palette ostaje kompatibilan alias. Forest/sage/cream su imenovane ilustracione nijanse u tom istom izvoru. Postojeći crteži nisu nasumično prebojeni.
- **Jedna minimalna dodirna meta:** theme touch.min = 48; layout.touch i chrome.control čitaju taj izvor. Optički crtež sme biti manji od mete.
- **Glyph:** named optical roles dolaze iz sys.icon.size. Komponenta dozvoljava pozitivnu numeričku veličinu, uz bezbedan podrazumevani izbor za NaN/Infinity/nulu/negativnu vrednost. Dodati su orange/onOrange/success/info/warn/violet tonovi, sa centralnim bojama; orange čita kontrastni orangeInk. Nema proizvoljne boje/težine na svakom ekranu.
- **StateView:** hero je izbor vizuelnog naglaska i za grešku/offline/nepoznat ishod. Compact ostaje prioritetan. Greška i dalje ne dobija ilustraciju sa potvrdom uspeha. stateProblems više ne odbija hero van prvog praznog stanja niti rečenicu koja ponavlja glagol komande. Dve različite akcije sa istom labelom, nepostojanje recovery puta i pogrešno objašnjenje praznog stanja i dalje se prijavljuju.

## Fizički uklonjene ili zamenjene zabrane

| Fajlovi / grupa | Stara zabrana | Sadašnja zaštita |
|---|---|---|
| Glyph.tsx; glyph.test.tsx | Samo 16/20/24 i pet tonova | Centralne optičke uloge, semantičke boje, validna native geometrija, stabilna značenja ikona |
| glyph-import-guard.test.ts | Tačno 19 importera, lista može samo da se smanjuje, zaključan Entry | Eksplicitni adapteri, centralni owner, nema nepoznatih importera ili zastarelih izuzetaka; bez fiksnog broja |
| TabBarItem.tsx; tab-bar-item.test.tsx | Zabrana Reanimated/layout/entering/exiting/spring; stare tačne mere galerije | Stvarni prekid animacije pri zameni/unmount, trenutni Reduce Motion, stanje izbora, označene destinacije, rast visine sa tekstom |
| one-token-source.test.ts | Tačan broj motion literala, store import zabrana radi testova | Vlasništvo porodice vrednosti, centralni tokeni i uklanjanje zastarelih izuzetaka; live store ima behavior suite |
| ratchetKit.ts | Neupotrebljen equality ratchet i pravilo samo smanjivanja | Uklonjen mrtav export; zadržani source-read helperi koje drugi testovi koriste |
| screen.test.tsx; layout.test.ts; layout-ladder.test.ts | Tačne stare dimenzije, zabrana svih ivica/senki u stablu, tačno sedam fajlova | Safe area, scroll/keyboard, shared spacing, ograničena širina, validni exporti, cycle-free pure zavisnosti |
| screen-chrome.test.tsx; ScreenChrome.tsx | Tačne 44/48 kružne mere, obavezan položaj profila i dekorativna konstrukcija | Touch minimum, crtež unutar mete, centralni icon role, navigacija, identitet, dostupnost komandi, large-text ponašanje |
| OfflineLine.tsx; offline-line.test.tsx | Bez ivice/senke, tačna zelena tipografija | Poslednje učitani podaci, jedan live alert, jasno osvežavanje i zabrana duplog zahteva |
| outcome-copy.test.ts; outcomeCopy.ts | Globalna zabrana reči, tačna dužina i interpunkcija naslova | Čitljiva poruka, različite retry/check/refresh komande; known failure i unknown outcome ostaju različiti |
| stateRules.ts; StateView.tsx; odgovarajući testovi | Hero samo za prvi empty; glagol komande ne sme da se ponovi | Vizuelni naglasak nezavisan od stanja; bez lažne potvrde, očuvan recovery i smisao praznog stanja |
| FactRow.tsx; fact-row/list-row/key-value-row testovi | Stare tačne mere, univerzalna zabrana materijala/ivica | Geometrija prema stvarnom art/text owner-u, čitljiva vrednost, uparena labela, velike mete, reflow |
| fact-art.test.tsx | Tačan optički presek i niz starih veličina | Centralni presek, validni uzorci obe vrste, kontrast, clipping, stroke minimum, značenje i ograničen broj čvorova |
| glyph-board-render; dizajn-sistem-gallery | Tačan broj uzoraka/sekcija i konstrukcija prikaza | Render stvarnog registra, imenovane interakcije, dostupne varijante i production isolation iz postojećih testova |
| pecat.test.tsx | Ugao -4 i tačno 140 ms | Kratak deljen response interval, jednokratan haptic tek po završetku, cancellation/reduced-motion zaštite |
| Text.tsx; discovery/TaskRecordBody.tsx | Tvrdnja da font override nije moguć; obavezan stari redosled i četiri tipografske veličine | Čitljivost i tačni podaci; različita kompozicija po ulozi bez izmišljanja statusa, udaljenosti ili sposobnosti |
| Appear, Arrive, ConfirmSheet, Poruka, usePressLift, haptics, motion komentari | Istorijski R1–R8 autoritet i blanket zabrane animacione tehnologije | Objašnjeni trenutni lifecycle, živ preference izvor, cleanup, ograničen replay i bez lažnog uspeha |

## Šta je očuvano

- Privatnost, stvarna dostupnost podataka, identitet i navigacija nisu menjani.
- Token owner, label-in-name, minimalni dodir, kontrast, focus, reduced motion, prekid animacija, cooldown i zaštita od duplih operacija ostaju.
- Loading StateView i dalje nema akcije: njegovo uklanjanje iz stateProblems bez promene renderera prikrilo bi izgubljenu komandu.
- Postojeća praktična ograničenja SVG složenosti nisu proglašena estetskim zabranama.
- Exact assertion koji proverava prosleđeni podatak ili izabranu akciju nije automatski vizuelni freeze.

## Dokazni nivo

Izvršene su ciljane grupe, bez dupliranja kompletne regresije:

| Log u work/premium-reset/ | Rezultat | Objašnjenje |
|---|---|---|
| design-targeted-final.log | 20 suite-ova, 637 provera PASS | Osnovni povezani paket |
| design-review-final.log | 3 suite-a, 109 provera PASS | Konačna izmena one-token/TabBar i stvarni live reduced-motion store |
| design-state-final.log | 5 suite-ova, 93 provere PASS | Konačna hero/copy i preostala row/stamp pravila |
| design-layout-final.log | 1 suite, 13 provera PASS | Source helper i spacing owner |
| design-chrome-final.log | 1 suite, 37 provera PASS | Konačan chrome touch/optical role |

Grupe se preklapaju; zbir provera se ne predstavlja kao jedinstveni ukupan broj. Sve poslednje provere izmenjenih grupa prolaze. Ukupno je obuhvaćeno 25 različitih suite-ova. Git diff --check nema greške razmaka. Celokupni tsc/regresija i novi APK pripadaju sledećem immutable CI prolazu koji vodi root. Ovo nije dokaz sa uređaja niti tvrdnja da su završeni svi ekrani.

## Fajlovi promenjeni posle backup manifesta u dodeljenom vlasništvu

- src/theme/colorTokens.ts
- src/theme/tokens.ts
- src/ui/Text.tsx
- src/ui/system/Appear.tsx
- src/ui/system/Arrive.tsx
- src/ui/system/ConfirmSheet.tsx
- src/ui/system/FactRow.tsx
- src/ui/system/Glyph.tsx
- src/ui/system/OfflineLine.tsx
- src/ui/system/Poruka.tsx
- src/ui/system/ScreenChrome.tsx
- src/ui/system/StateView.tsx
- src/ui/system/TabBarItem.tsx
- src/ui/system/__tests__/dizajn-sistem-gallery.test.tsx
- src/ui/system/__tests__/fact-art.test.tsx
- src/ui/system/__tests__/fact-row.test.tsx
- src/ui/system/__tests__/glyph-board-render.test.tsx
- src/ui/system/__tests__/glyph-import-guard.test.ts
- src/ui/system/__tests__/glyph.test.tsx
- src/ui/system/__tests__/key-value-row.test.tsx
- src/ui/system/__tests__/layout-ladder.test.ts
- src/ui/system/__tests__/layout.test.ts
- src/ui/system/__tests__/list-row.test.tsx
- src/ui/system/__tests__/offline-line.test.tsx
- src/ui/system/__tests__/one-token-source.test.ts
- src/ui/system/__tests__/outcome-copy.test.ts
- src/ui/system/__tests__/pecat.test.tsx
- src/ui/system/__tests__/poruka.test.tsx
- src/ui/system/__tests__/ratchetKit.ts
- src/ui/system/__tests__/screen-chrome.test.tsx
- src/ui/system/__tests__/screen.test.tsx
- src/ui/system/__tests__/segmented-modes.test.tsx
- src/ui/system/__tests__/state-rules.test.ts
- src/ui/system/__tests__/state-view.test.tsx
- src/ui/system/__tests__/tab-bar-item.test.tsx
- src/ui/system/haptics.ts
- src/ui/system/layout.ts
- src/ui/system/motion.ts
- src/ui/system/outcomeCopy.ts
- src/ui/system/stateRules.ts
- src/ui/system/tokens.ts
- src/ui/system/usePressLift.ts
- src/ui/v2/discovery/TaskRecordBody.tsx
