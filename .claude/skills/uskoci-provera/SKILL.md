---
name: uskoci-provera
description: Use before declaring any USKOČI change done, before commits, CI/QA runs or building an APK. Lists the real verification commands and evidence rules.
---

# USKOČI provera

## Komande
- Tipovi: `npx tsc --noEmit` (mora 0).
- Testovi: `npm test` (lista je u `package.json`; novi test se tamo dodaje). Pojedinačno: `node --test scripts/<fajl>.test.cjs`.
- SQL testovi traže `@electric-sql/pglite`; ako fali: `npm ci`.
- Migracije: `python supabase/migrations/check_migration_integrity.py` (mora `PASS`).
- QA APK: GitHub Actions workflow `.github/workflows/uskoci-qa-apk.yml` (traži push — samo uz reč vlasnika). Proveri run: `gh run view <id> --json status,conclusion,jobs`.

## Pravila dokaza
- Razdvoji: SOURCE, lokalni test, CI, DEV, Android, produkcija. Ne tvrdi proveru koja nije izvršena.
- Ne prilagođavaj test da prihvati kvar; ne briši negativne zaštite. Test uklanjaš samo kad vlasnik ukine funkciju.
- Za malu izmenu: direktan test + susedni; za celinu: tok, tipovi, SQL/bezbednosni ugovori.
- Commit lokalno je u redu; push, DEV deploy i APK izdanje samo uz izričito odobrenje.
- Na kraju celine: kratak checkpoint u `docs/plan/CODEX_PLAN_RADA.md` (šta, fajlovi, provera, šta je otvoreno).

## Android
- Telefon: `adb devices` (`%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`). Instalacija APK-a samo uz pitanje vlasnika.
- E2E: skil `maestro-mobile-testing` za tokove objava → prijava → izbor → Dogovor → poruka → ocena.
