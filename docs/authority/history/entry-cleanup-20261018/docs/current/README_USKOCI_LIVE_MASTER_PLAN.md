# USKOČI — LIVE MASTER PLAN paket

Ovaj paket pretvara `USKOCI_OPERATIVNI_MASTER_PLAN_V3_LIVE_2026-09-29.html` u **živi statusni prikaz bez drugog trackera**.

## Autoritet

- `docs/control/redovi.json` ostaje jedini statusni registar 62 toka.
- HTML je operativni priručnik + projekcija statusa.
- `master-plan-live-state.json` sadrži samo mali ručni presek koji `redovi.json` ne zna: P6/release poruka, legal/store gate brojevi i sledeći izvršni posao.
- Generator ne pristupa mreži, ne zove Supabase, ne deploy-uje i ne commit-uje.

## Predložene putanje u repou

```text
docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html
scripts/control/osvezi-master-plan.mjs
docs/control/master-plan-live-state.json
```

Kopiraj `master-plan-live-state.example.json` kao `docs/control/master-plan-live-state.json` i menjaj samo polja koja imaju novi konkretan dokaz.

## Posle svakog završenog paketa

1. završi najmanji otvoreni nivo i sačuvaj receipt/commit;
2. ažuriraj `redovi.json` postojećim ovlašćenim tokom;
3. po potrebi promeni P6/release/next u `master-plan-live-state.json`;
4. pokreni:

```bash
node scripts/control/osvezi-master-plan.mjs \
  --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html \
  --redovi docs/control/redovi.json \
  --state docs/control/master-plan-live-state.json

node scripts/control/osvezi-master-plan.mjs --check \
  --html docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html
```

5. otvori HTML i proveri dashboard + pogođene kartice;
6. **ne pravi novi master plan** — nastavi da osvežavaš isti.

## Browser-only pregled

U poglavlju **25 · Živi status i osvežavanje** postoji dugme **Učitaj redovi.json**. Ono prikazuje novije statuse bez izmene fajla na disku. Za trajno osvežavanje koristi Node generator.

## Konzervativna status klasifikacija

Generator namerno ne proglašava `SOURCE/CI PASS` za kompletan DONE. Statusi sa `NATIVE`, `PHONE/TELEFON`, `DEVICE/UREĐAJ`, `PENDING`, `ČEKA` ili `PREDSTOJI` ostaju u `native/device pending`. `NOT IMPLEMENTED/BLOCKED/REQUIRED` su blokirani. Strogi DONE je rezervisan za eksplicitno zatvoren status bez otvorenog kvalifikatora.

Ako postojeći tracker koristi novi rečnik, prvo doradi klasifikator u generatoru i proveri rezultat; ne prepravljaj 62 HTML kartice ručno.
