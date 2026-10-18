# USKOČI — počni ovde

Jedan aktivan proizvod, jedan registar statusa i postojeći LIVE plan. Ovaj fajl je ulaz u rad, ne novi plan ili potvrda da je aplikacija završena.

## Redosled čitanja

1. Najnovija poruka vlasnika i [AGENTS.md](../../AGENTS.md): pravila, poslovne granice i dozvole.
2. [Registar 62 toka](../control/redovi.json) i [LIVE prikaz](USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html): dokazi i otvoren posao.
3. Za UI: [sadašnji dizajnerski pravac](../implementation/OWNER_DESIGN_DIRECTION_20260922.md). Za drugi domen: relevantan izvor iz [mape autoriteta](../authority/AUTHORITY_INDEX.md).
4. Izvorni kod i dokaz za konkretan tok koji se menja. Stare nacrte i handoff dokumente otvaraj po potrebi, ne kao lanac obaveznog čitanja niti kao trenutno stanje.

## Radni prostor — zatečeno 18.10.2026.

- Aktivni checkout ove sesije: `C:\Users\user\Desktop\USKOCI ZAVRSAVANJE\USKOCI-EAN`.
- Grana pri inventaru: `feature/unified-qa-master-20261017`; početni HEAD `938df57d81e98821255d361afd6b6201e996889d`. Proveri `git status` i `git branch --show-current` pri nastavku; ovaj datum ne zaključava buduću granu.
- Kanonski DEV/ALPHA: `leqcwgzvjsxugfgzdmth`. Kod u lokalnom folderu nije dokaz primene na taj projekat.
- `USKOCI-CLEAN`, donor folderi i raniji APK-ovi nisu automatski trenutna radna kopija. Ne prebacuj rad tamo zbog starog uputstva.
- Izvor APK-a, eventualni OTA update i instalacija na uređaju proveravaju se posebno. Ime fajla, verzija `1.0.0` ili najnoviji datum nisu dovoljni.

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

Naredni usaglašeni posao: [komentar Work analize, nove read-only provere i redosled izvođenja](../implementation/ui-ux-pass-20261002/WORK_ANALYSIS_RECONCILIATION_20261018.md). Njegovi sledeći koraci preneti su u postojeće redove registra; originalne ranije napomene su sačuvane. Pregled ne znači da su implementacioni paketi već zatvoreni.

## Šta znači „trenutno“

Svaki zaključak označi: SOURCE, TEST, DEV APPLIED, APK BUILT, EMULATOR, PHONE ili RELEASE. Datum i tačan izvor pripadaju dokazu. Stara slika može pokazati stari problem; njen naziv AFTER_FIX nije potvrda da prikazuje sadašnji kod. Budući manifest isporuke treba da poveže postojeći `buildIdentity`, hash APK-a, OTA identitet, DEV snapshot i slike. Taj potpuni manifest nije napravljen ovim uređivanjem dokumentacije.

## Održavanje postojećeg LIVE plana

`docs/control/redovi.json` ostaje jedini registar. `master-plan-live-state.json` nosi dopunski kratki prikaz; HTML je projekcija. Posle paketa dopuni postojeće redove dokazima, bez podizanja nivoa prihvatanja samo na osnovu izvora, pa pokreni:

```sh
node scripts/control/osvezi.mjs
node scripts/control/osvezi-master-plan.mjs --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html --redovi docs/control/redovi.json --state docs/control/master-plan-live-state.json
node scripts/control/osvezi-master-plan.mjs --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html --redovi docs/control/redovi.json --state docs/control/master-plan-live-state.json --check
```

Ne kopiraj ponovo example state preko postojećeg stanja. Generisanje ne objavljuje hosted tablu i ne menja Supabase. Browser dugme „Učitaj redovi.json“ menja samo trenutni prikaz. Za detalje i konzervativnu klasifikaciju koristi [control README](../control/README.md).
