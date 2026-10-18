# USKOČI

Postojeća Expo / React Native aplikacija za objavljivanje zadataka, prijave i dogovore. Supabase je autoritet za poslovne podatke, dozvole i promene stanja.

## Nastavak rada

- [Pravila i autoritet](AGENTS.md)
- [Aktuelni operativni plan](docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html)
- [Jedini registar statusa](docs/control/redovi.json)
- [Izgled, završne izmene i tačan obim dokaza](docs/implementation/ui-ux-pass-20261002/VISUAL_FINISHING_20261002.md)
- [Pregled proizvoda i povezanih tokova](docs/implementation/ui-ux-pass-20261002/UIUX_PLAN_AND_STATUS_20261002.md)

Aktuelna radna grana je `work/uskoci-ui-unification-20260924`. Istorijski GitHub default nije zamena za nju.

## Lokalni rad

```sh
npm ci
npm start
```

`npm ci` primenjuje odobrenu native zakrpu i sinhronizuje postojeće entry resurse. Reference, `patches/` i postinstall ulazi pripadaju aktivnom buildu; čuvaju se pri čišćenju. Android razvojni APK sastavlja postojeći workflow `.github/workflows/build-android-dev-apk.yml` sa izborom `phone` ili `emulator`.

## Izdavanje

DEV APK i javno izdanje imaju odvojene uslove. Store paket `rs.uskoci`, produkcioni backend, provider konfiguracija, pravni sadržaj i potpisani AAB prate postojeći plan i eksplicitnu odluku o objavi. Dokaz ranijeg APK-a ostaje vezan za taj izvor i obim.

Expo template komanda `reset-project` uklonjena je iz npm skripti: ovo je postojeća aplikacija, a reset skripta premešta ili briše njen izvor. Istorijska datoteka ostaje sačuvana do zasebnog arhiviranja; ne koristi se u normalnom radu.
