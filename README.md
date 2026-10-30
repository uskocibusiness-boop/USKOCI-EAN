# USKOČI — aktivni izvorni kod

**Aktuelna radna grana za nastavak razvoja:** `work/rev14-review-f17` u
`uskocibusiness-boop/USKOCI-EAN`; [PR #43](https://github.com/uskocibusiness-boop/USKOCI-EAN/pull/43)
je Draft prema `feature/uskoci-cisto`. Default GitHub grana NIJE radna grana.
Aplikacija je Expo / React Native; DEV Supabase je `leqcwgzvjsxugfgzdmth`.

## Jedini pravilan ulaz za Codex

1. Prvo pročitaj [nastavak rada](docs/continuation/NASTAVAK_RADA.md), proveri stvarni remote HEAD / lokalno stablo i poslednji CI na tom SHA-u.
2. **Jedini operativni plan** je [CODEX_PLAN_RADA.md](docs/plan/CODEX_PLAN_RADA.md), posebno §11.2a (izvršni status), §4.2–4.3 (zavisnosti i acceptance) i **§12.5–12.6** (integritet dokaza i usaglašena izvršna istina).
3. **Jedini noviji Product/UX kanon** je [USKOCI_PRODUCT_UX_MASTER.md](docs/product/USKOCI_PRODUCT_UX_MASTER.md) (tačna originalna kopija 29.10.2026). Čitaj samo relevantni S01–S18 i E/J ugovor za konkretan posao; istorija iza „ISTORIJSKA EVIDENCIJA” nije novi autoritet.
4. [REV10/REV13/REV14 dokazni most](docs/continuation/source-bridge-20261030/README.md) ima 208 mapiranih istorijskih nalaza, 77 ekranskih ugovora i 44 dodatna nalaza. **Istorijski dokaz NIJE trenutni bug niti potvrđen PASS.** Obnovi/verifikuj jednom, otvaraj samo potrebne izvore.
5. Kod, SQL, Edge, DEV, NATIVE i PROD razlikuj po izvoru, testu, run ID-ju i statusu. R01 strict FAIL, R10 closure i release ostaju stvarni gates. Ne pravi drugi master, ne biraj old default branch i ne ponavljaj puni audit svakog ZIP-a za svaku ispravku.


## Šta je u folderu

- `src/`, `assets/`, `modules/`, `plugins/`, `patches/`, `config/` i `vendor/`:
  klijentski kod i resursi.
- `supabase/functions/` i `supabase/migrations/`: Edge kod i kanonske SQL
  migracije. Istorija primena na DEV-u nije isto što i broj lokalnih SQL fajlova.
- `src/**/__tests__/`, `supabase/proofs/` i `supabase/candidates/`: postojeće
  provere i kandidati. Kandidat SQL nije automatski primenjena migracija.
- `scripts/`: provere ugovora builda, nativne zakrpe i resursa.

`node_modules/`, `android/`, `.expo/`, lokalni `.env` i generisani resursi se ne
prate u Git-u. Instalacija zavisnosti na novoj mašini treba da ih obnovi iz
`package-lock.json`, `patches/` i sačuvanih ulaznih resursa.

## Brze lokalne provere

```text
npm ci
npx tsc --noEmit
npm test -- --runInBand
node --test supabase/proofs/ai/ai_edge_context.test.mjs
python supabase/migrations/check_migration_integrity.py
```

Preview APK cilja DEV. Produkcioni build/OTA je namerno blokiran u
`scripts/build-contract.cjs` dok se ne podesi i proveri zaseban produkcioni
backend. Prolaz tipova i lokalnih testova sam po sebi ne potvrđuje instalaciju
ili korisnički tok na telefonu.
