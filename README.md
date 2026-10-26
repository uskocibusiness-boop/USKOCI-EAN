# USKOČI — aktivni izvorni kod

Ovaj folder prati GitHub granu `feature/uskoci-cisto` repozitorijuma
`uskocibusiness-boop/USKOCI-EAN`. Aplikacija je Expo / React Native projekat;
DEV backend je Supabase projekat `leqcwgzvjsxugfgzdmth`.

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
