# USKOČI — počni ovde

Jedan aktivan proizvod, jedan registar statusa i postojeći LIVE plan. Ovaj fajl je ulaz u rad, ne novi plan ili potvrda da je aplikacija završena.

## Redosled čitanja

1. Najnovija poruka vlasnika i [AGENTS.md](../../AGENTS.md): pravila, poslovne granice i dozvole.
2. [Aktuelni fizički presek i granice kandidata](CURRENT_BASELINE_20261018.md), zatim [Registar 62 toka](../control/redovi.json) i [LIVE prikaz](USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html): dokazi i otvoren posao.
3. Za UI: [jedini aktivan Premium White canon](../implementation/design-system/PREMIUM_WHITE_CANON.md) i [forenzički registar ograničenja](../implementation/design-system/DESIGN_CONSTRAINT_REGISTRY_20261018.md). Za drugi domen: relevantan izvor iz [mape autoriteta](../authority/AUTHORITY_INDEX.md).
4. Izvorni kod i dokaz za konkretan tok koji se menja. Stare nacrte i handoff dokumente otvaraj po potrebi, ne kao lanac obaveznog čitanja niti kao trenutno stanje.

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

## Šta znači „trenutno“

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
