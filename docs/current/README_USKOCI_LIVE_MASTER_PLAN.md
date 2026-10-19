# USKOČI — počni ovde

Jedan aktivan proizvod, jedan registar statusa i postojeći LIVE plan. Ovaj fajl je ulaz u rad, ne novi plan ili potvrda da je aplikacija završena.

## Redosled čitanja

1. Najnovija poruka vlasnika i [AGENTS.md](../../AGENTS.md): pravila, poslovne granice i dozvole.
2. [Aktuelni fizički presek i granice kandidata](CURRENT_BASELINE_20261018.md), zatim [Registar 62 toka](../control/redovi.json) i [LIVE prikaz](USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html): dokazi i otvoren posao.
3. Za UI: [jedini aktivan Premium White canon](../implementation/design-system/PREMIUM_WHITE_CANON.md) i [forenzički registar ograničenja](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md). Za drugi domen: relevantan izvor iz [mape autoriteta](../authority/AUTHORITY_INDEX.md).
4. Izvorni kod i dokaz za konkretan tok koji se menja. Stare nacrte i handoff dokumente otvaraj po potrebi, ne kao lanac obaveznog čitanja niti kao trenutno stanje.

## Potvrđene odluke vlasnika — 19.10.2026.

[Datirani dodatak odluka](OWNER_DECISIONS_20261019.md) konsoliduje opseg prvog izdanja i ponašanje proizvoda: Srbija/Android kontrolisana proba, prvo prijavljeni korisnik, jedan nalog za obe perspektive, AI izmene sa jednim pregledom, glasovni unos, grupni mediji i granice istorije, ponovna objava pre prvog izbora, fleksibilan termin, otkaz/zamena, recenzije posle potvrđenog završetka, portfolio kasnije, 18+ i plaćanje van aplikacije.

Najnoviji nalog odobrava **prvi povezani AI paket na DEV-u i emulatoru**; ranije READ-ONLY formulacije planskog izvora ne zaustavljaju taj posao. Šira politika nije proglašena implementiranom: relevantni redovi nose `owner_decisions_20261019` sa odobrenim smerom i `proofStatus: PENDING`. Prethodni datirani dokazi ostaju zasebni. Ovo nije novi master plan, pravna potvrda ili javna objava.

## Radni prostor — zatečeno 18.10.2026.

- Aktivni checkout ove sesije: `C:\Users\user\Desktop\USKOCI ZAVRSAVANJE\USKOCI-EAN`.
- Grana pri inventaru: `feature/unified-qa-master-20261017`; pre-cleanup HEAD `eaa38a04e20be24bba71840660493b634180ee72` uz sačuvane zatečene radne izmene. Proveri `git status` i `git branch --show-current` pri nastavku; ovaj datum ne zaključava buduću granu.
- Kanonski DEV/ALPHA: `leqcwgzvjsxugfgzdmth`. Kod u lokalnom folderu nije dokaz primene na taj projekat.
- `USKOCI-CLEAN`, donor folderi i raniji APK-ovi nisu automatski trenutna radna kopija. Ne prebacuj rad tamo zbog starog uputstva.
- Izvor APK-a, eventualni OTA update i instalacija na uređaju proveravaju se posebno. Ime fajla, verzija `1.0.0` ili najnoviji datum nisu dovoljni.

## Jedan aktivan dizajn

Premium White je odobrena foundation smernica, sa devet povezanih talasa iz §15 canona. Istorijski R1–R8/V28/V31, stare motion zabrane, identični pikseli i ručni formulari nisu drugi aktivni ugovor. Fizički history banner označava povučeni vizuelni autoritet; funkcionalni ugovori i datirani dokazi se čitaju u svom domenu. [Registar ograničenja](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md) razdvaja mehaničkog kandidata, pregledan nalaz i stvarnu fizičku izmenu. Broj klasifikovanih redova nije broj zatvorenih problema.

## Gde je šta

| Oblast | Aktuelni ulaz |
| --- | --- |
| Rute i navigacija | `src/app/`, `src/app/(app)/_layout.tsx` |
| Aktivna prezentacija | `src/ui/v2/` i funkcionalne porodice `src/ui/`; naziv v2 ne znači da je kod zastareo |
| Zajednički izgled | `src/ui/system/tokens.ts`, `layout.ts`, postojeći sistemski elementi |
| Početni ekran i brend | `src/ui/entry/`; istorijski donori nisu obavezna kompozicija |
| AI zadatak / radni profil | `nova.tsx`, `radnik.tsx`, `src/ui/aiFirst/` i odgovarajuće Edge funkcije |
| Podaci i poslovna pravila | `src/data/`, `src/features/`, `supabase/functions/`, primenjene migracije i ledger |
| Razvojni prikazi | 21 sačuvana scena u `src/designLab/`, van Expo Router ruta; Android export proverava da ih nema u proizvodnom bundle-u |
| Testovi | Aktuelni `jest.config.cjs`; broj i prolaznost čitati iz stvarnog izvršavanja |
| Build | `app.config.js`, `app.json`, `eas.json`, `metro.config.cjs`; za aktuelni objedinjeni APK: `.github/workflows/build-latest-v5-preview-apk.yml` sa `target=emulator` |
| DEV dokaz | `supabase/operations/dev-alpha/ledger/`, datirani `docs/control/dev_snapshot.json` |
| Istorija | `docs/authority/history/` i datirani izveštaji; nisu novi nalozi za rad |

Izveštaj ovog inventara: [čišćenje i predlog povezane aplikacije](../implementation/ui-ux-pass-20261002/CURRENT_BASELINE_CLEANUP_20261018.md). To je datirani nalaz uz isti registar, ne drugi tracker.

Aktuelni APK workflow je **Build latest V5 Android preview APK** (`build-latest-v5-preview-apk.yml`). Pokrenuti ga na stvarnom integration HEAD-u i sačuvati izvorni SHA, run ID i artifact receipt. Stariji `build-android-dev-apk.yml` ima ograničenje na istorijsku granu `work/uskoci-ui-unification-20260924`; njegovo prisustvo nije nalog za promenu trenutne grane niti za isporuku starog izvora.

Usaglašeni posao: [komentar Work analize i izvršavanje plana](../implementation/ui-ux-pass-20261002/WORK_ANALYSIS_RECONCILIATION_20261018.md). Odeljci 1–9 čuvaju početni pregled; odeljak 10 i [datirani izveštaj isporuke](../implementation/ui-ux-pass-20261002/AI_ALIAS_DELIVERY_20261018.md) navode naknadno primenjene celine i preostali posao. Isti rezultati ulaze u postojeće redove registra.

## Prvi povezani AI paket — 19.10.2026.

Izvor `82991de1`: [izveštaj](AI_FIRST_PACKAGE_20261019.md) i [dokaz](evidence/AI_FIRST_PACKAGE_20261019.json). DEV Task107/Worker60, 6 stvarnih odgovora, eksplicitno čuvanje DRAFT zadatka i profila, 621/13908 CI testova PASS. APK 6430f2fb je instaliran i izvor/ugrađeno ažuriranje potvrđeni na emulatoru; task 361/390/412 dp × font 1,0/1,3, worker 361 dp / 1,3 i Back/neposlati tekst provereni. Brzina 6–15 s i preostali ručni izbor države/načina rada ostaju otvoreni. Ovo ne zatvara ceo AI/region/matching/push tok.


## AI i potvrda mape — drugi paket, 19.10.2026.

[Izveštaj](AI_MAP_PACKAGE_20261019.md) i [dokaz](evidence/AI_MAP_PACKAGE_20261019.json): runtime **7f202518**, DEV **Task108/Worker61/LocationSearch24**. AI semantičke izmene, namenski map pin, razdvojeno čuvanje nacrta/objava, oporavak istog Need-a i očišćen početni upit adrese. CI **39298019592 SUCCESS: 621 / 13.968 PASS**. APK instaliran bez brisanja sesije, hash i About/embedded OTA potvrđeni. Native pregled/mapa na 361/390/412 dp × font 1.0/1.3, ruta, Back/neposlati tekst i offline retry potvrđeni na checkpoint-u 24736a79; završna automatska pretraga dodatno potvrđena na 7f202518. Osam AI odgovora/15 poziva/$0.135679 interna procena; **5.7–25.3s — brzina još otvorena**. Jedan eksplicitan DRAFT Save; nema Publish, aktivacije, matching ili push probe. Ovo ne zatvara celu aplikaciju ili javno izdanje.

## Topliji AI i precizniji nacrt — 19.10.2026.

[Izveštaj](AI_WARMTH_TIMING_20261019.md) i [dokaz](evidence/AI_WARMTH_TIMING_20261019.json): izvor **7d584c27**, DEV **Task112/Worker67**, 34/34 fajla potvrđena. Jedan topao glas, očuvanje nezavisnih odgovora, eksplicitne kalendarske operacije i tačan kanonski naziv/UUID. Završni radnički početak i izmena samo ponedeljka imaju READY pregled i ispravne sate. Ukupno 14 QA poruka/25 modelskih poziva/$0.189180 interne procene, bez kanonske izmene pre Save-a. **Brzina 5.5–12.9s ostaje otvorena**; merenja ukazuju na modelske krugove. Ovaj paket nema novi APK ili novu native/push potvrdu.

## Šta znači „trenutno“

<!-- AI_LOCATION_GUIDANCE_START -->
Naknadno 19.10 — **lokacije i vođenje razgovora**: Task101/Worker55 primenjeni, klijent a73a78f4 ima 621/13.877 testova PASS. APK a73a78f4, run 39208880951, instaliran -r; base.apk SHA256 788a96379ad3abd0c60375f07e6c20a5048a24bb1995c7fe4bdf33c25537ceca jednak artifact-u. Native rezultati: PASS: task explanation readable before map confirmation, explicit return to map, 361/390/412 dp at font 1.0/1.3; closed worker conversation resumes current draft rather than retaining abandoned ID. No claim that active draft restart or a fresh writable worker conversation was tested.. [Dokaz](evidence/AI_LOCATION_GUIDANCE_20261019.json). U 16 stvarnih poziva potvrđeno dopunjavanje grada i očuvanje radijusa; otkriven i popravljen skriven odgovor uz mapu. Nova worker usluga i dalje može ostati PENDING_CLASSIFICATION zbog risk-action politike: nije gotov matching. Drugi akter nastavio je isti worker nacrt; njegovo kasnije čuvanje nije rezultat ovog testa.
<!-- AI_LOCATION_GUIDANCE_END -->



19.10.2026: [AI razgovori, pregled i tastatura — primena i stvarne probe](AI_CONVERSATION_CONTINUATION_20261019.md). Task Edge v100, Worker v54, novi klijent `2df06add` / CI `39202330027 SUCCESS`, 621 grupa / 13.873 testa PASS. APK je instaliran na emulatoru; provereni input/send na tri širine i dva fonta, povratak u isti razgovor i stvarne AI izmene. [Manifest native dokaza](evidence/AI_CONVERSATION_NATIVE_20261019.json). Nema nove objave zadatka/Save profila/push probe, phone ili release prihvatanja. Regionalni model i preostali AI-only/kompletni UI tokovi ostaju otvoreni.

Naknadni DEV paket od 18.10: [primena, otkrivena invoker regresija i proverena forward ispravka](DEV_RELIABILITY_APPLICATION_20261018.md). DEV ledger 288; Početna ima ograničeni javni preview i tri taxonomy konflikta PT409. Phone APK iz `bb0ba8d`, CI `39163968732`, sada je BUILT, ali nije ovde instaliran; nema OTA objave ili podizanja phone/release prihvatanja.

Prethodno: [tehničko čišćenje klijenta](CLIENT_CLEANUP_20261018.md), 15 mrtvih modula i 44 zastarela mock-a, puna regresija 619 grupa / 13.824 testa PASS. Aktivan UI/ponašanje i server ostaju nepromenjeni; potvrđen je Android source/asset paritet. Ovo čišćenje nije bilo u tadašnjem APK-u; naknadni 19.10 paket ga uključuje. Slede Home core čitanje i oporavak nepotpunih stranica Dogovora, zatim ciljano preostalo čišćenje. Prethodni baseline i lokalni izveštaji zadržavaju svoje datirane granice.

Svaki zaključak označi: SOURCE, TEST, DEV APPLIED, APK BUILT, EMULATOR, PHONE ili RELEASE. Datum i tačan izvor pripadaju dokazu. Stara slika može pokazati stari problem; njen naziv AFTER_FIX nije potvrda da prikazuje sadašnji kod. [Manifest isporuke](../implementation/ui-ux-pass-20261002/AI_ALIAS_DELIVERY_20261018.json) povezuje `buildIdentity`, hash APK-a, OTA identitet, DEV stanje i datirane slike; posebno razlikuje instalirani izvor, novi kandidat i neuspešne ranije pokušaje. Emulator dokaz ne podiže PHONE/RELEASE status.

Nastavak od 18.10: [Početna i Dogovori](HOME_READ_CONTINUATION_20261018.md). Početna uzima tačne zbirove iz jedne stranice prijava; čitanja prate izlazak sa ekrana, a Dogovori odbijaju neispravan nastavak umesto delimičnog uspeha. Puna regresija 621 grupa / 13.861 test PASS; DEV read-only paritet tri naloga. Novi emulator checkpoint uključuje i prethodno čišćenje, a build/install dokaz vodi se odvojeno. Preostali zadaci su sažeci zadataka/Dogovora i nezavisne osnovne sekcije.

## Održavanje postojećeg LIVE plana

`docs/control/redovi.json` ostaje jedini registar. `master-plan-live-state.json` nosi dopunski kratki prikaz; HTML je projekcija. Posle paketa dopuni postojeće redove dokazima, bez podizanja nivoa prihvatanja samo na osnovu izvora, pa pokreni:

```sh
node scripts/control/osvezi.mjs
node scripts/control/osvezi-master-plan.mjs --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html --redovi docs/control/redovi.json --state docs/control/master-plan-live-state.json
node scripts/control/osvezi-master-plan.mjs --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html --redovi docs/control/redovi.json --state docs/control/master-plan-live-state.json --check
```

Ne kopiraj ponovo example state preko postojećeg stanja. Generisanje ne objavljuje hosted tablu i ne menja Supabase. Browser dugme „Učitaj redovi.json“ menja samo trenutni prikaz. Za detalje i konzervativnu klasifikaciju koristi [control README](../control/README.md).

## 19.10 — oba AI toka i celo stablo

Povezan paket bez limita 96 i šest novih nivoa, prirodni nazivi, pitanje umesto slepe klasifikacije, očuvani potvrđeni načini rada i pregled profila bez dodatnog ručnog formulara: [AI_FULL_TREE_20261019.md](AI_FULL_TREE_20261019.md). Tačan dokaz primene i APK-a čitati tamo; izvor i offline uspeh nisu sami po sebi DEV ili device dokaz.

Završni presek: DEV primenjen, osam stvarnih QA odgovora i tri zasebna signed Save-a sa potvrđenim UUID vezivanjem; 621 paketa / 13.884 testa PASS. APK source f56c94c3, CI 39219527009 SUCCESS, instaliran na emulatoru bez brisanja sesije i ograničeno pregledan. Nema phone ili push-delivery tvrdnje; ceo poslovni tok se ne označava GOTOV na osnovu ovog paketa.

## 19.10 — navodiva pretraga kataloga tokom razgovora

DEV Task105/Worker58: oba razgovora koriste verzionisanu serversku pretragu celog kataloga i grana, bez whole-tree prompt-a. SQL20261019092405, PG16/17 PASS; 746 Node +56 završni delta PASS; 621 Jest paketa,13875 PASS/9skip. Pet QA poruka/16 modelpoziva,13–19s,0,143341USD interni obračun. Prva3READY; retka restauracija ostaje NEEDS_REVIEW zbog postojećih parentmodes. Nema Save/Publish/aktivacije; kanonski otisci nepromenjeni. docs/current/AI_CATALOG_TOOLS_20261019.md

Prethodni full-tree paket je datirani prethodnik. Aktivni Edge sada koristi alat za stranice i grane, ne slanje kompletnog stabla u prompt. Tada otvoreno proširenje režima postojeće grane naknadno je rešeno i provereno u SERVICE_EXECUTION_20261019; stariji nalaz ostaje datirani dokaz.

## 19.10 — konkretna usluga, predaja i potvrđeno povezivanje

DEV Task106/Worker59, 25/25 SQL i 16/14 Edge readback. Parent režimi više ne blokiraju konkretnu uslugu; EXTEND_MODE čuva UUID. Sedam živih scenarija/osam poruka/22 model poziva,0,222529USD interni obračun; četiri DRAFT Save-a i aktivan izolovan QA radnik. Stvarna dostava RS matches=true, samo pickup uz shipping-only radnika matches=false. CREATE_CHILD i EXTEND_MODE primenjeni tek nakon Save. 621/13898 PASS; APK+preview OTA5f422987 provereni na emulatoru,361/390/412dp,font1/1.3. Bez objave zadatka ili stvarne push/phone provere. docs/current/SERVICE_EXECUTION_20261019.md

[Tačan rezultat, granice i naredni posao](SERVICE_EXECUTION_20261019.md).
