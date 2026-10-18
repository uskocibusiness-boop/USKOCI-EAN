# USKOČI

Postojeća Expo / React Native aplikacija za objavljivanje zadataka, prijave i dogovore. Supabase je autoritet za poslovne podatke, dozvole i promene stanja.

## Nastavak rada

- **[Počni ovde — aktuelni radni prostor, kod, dokazi i istorija](docs/current/README_USKOCI_LIVE_MASTER_PLAN.md)**
- [Pravila i autoritet](AGENTS.md)
- [Aktuelni operativni plan](docs/current/USKOCI_OPERATIVNI_MASTER_PLAN_LIVE.html)
- [Jedini registar statusa](docs/control/redovi.json)
- [Aktuelni dizajnerski pravac](docs/implementation/OWNER_DESIGN_DIRECTION_20260922.md)
- [Inventar nagomilavanja i redosled sređivanja, 18.10.2026.](docs/implementation/ui-ux-pass-20261002/CURRENT_BASELINE_CLEANUP_20261018.md)

Na inventaru 18.10.2026. aktivan je checkout `USKOCI-EAN`, grana `feature/unified-qa-master-20261017`. Pri nastavku proveri Git; prethodna `work/uskoci-ui-unification-20260924` i istorijski GitHub default nisu nalog za promenu grane. Datirani izveštaji ostaju dokaz svog izvora, ne sadašnjeg APK-a.

## Lokalni rad

```sh
npm ci
npm start
```

`npm ci` primenjuje odobrenu native zakrpu i sinhronizuje postojeće entry resurse. Reference, `patches/` i postinstall ulazi pripadaju aktivnom buildu; čuvaju se pri čišćenju. Android razvojni APK sastavlja postojeći workflow `.github/workflows/build-android-dev-apk.yml` sa izborom `phone` ili `emulator`.

## Izdavanje

DEV APK i javno izdanje imaju odvojene uslove. Store paket `rs.uskoci`, produkcioni backend, provider konfiguracija, pravni sadržaj i potpisani AAB prate postojeći plan i eksplicitnu odluku o objavi. Dokaz ranijeg APK-a ostaje vezan za taj izvor i obim.

Expo template komanda `reset-project` uklonjena je iz npm skripti: ovo je postojeća aplikacija, a reset skripta premešta ili briše njen izvor. Istorijska datoteka ostaje sačuvana do zasebnog arhiviranja; ne koristi se u normalnom radu.
