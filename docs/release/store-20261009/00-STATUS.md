# Status spremnosti za prodavnice — 09.10.2026.

**Google Play Android: PUBLIC NO-GO. Apple App Store iOS: NO-GO.**

## Šta je potvrđeno

- Gmail ima zvaničnu Play Console potvrdu verifikacije identiteta od 5. oktobra 2026. To nije dokaz prava na Production niti postojanja app listinga.
- Store Android identitet `rs.uskoci` i EAS production app-bundle konfiguracija postoje. Preview paket `rs.uskoci.preview` nije store paket.
- Canonical `eas.json` preview i production oba koriste **isti DEV Supabase projekat** `leqcwgzvjsxugfgzdmth`. Izolovan production backend nije potvrđen.
- Prethodni preview APK je ciljao Android API36; finalni **potpisani AAB nije viđen**. Statički native 16 KB check iz forenzičkog audita prijavljuje RELRO 24/28 neusaglašenost, bez potvrđenog crasha.
- In-app closure/UGC/report/block/AI izvor postoje, ali legal consent/real closure/report AI-output nisu javno release-verifikovani.
- GitHub danas ima tri scoped uspešna testa (37975515493, 37973737055, 37973736906); oni nisu integralni store audit.
- iOS nema permanentan bundleIdentifier, potpisanu IPA, TestFlight i real iPhone E2E dokaz.

## Release blokeri

| ID | Blokada | Kriterijum za potvrdu |
|---|---|---|
| P0-01 | Izolacija produkcije | Odobren novi backend, tačne migracije, RLS/Auth/Storage/Edge/cron i EAS produkciona veza; bez kopiranja DEV naloga |
| P0-02 | Potpisani AAB / ABI | Dokazan EAS build, SHA256, upload cert, package `rs.uskoci`, versionCode, API36, 16 KB i fizički Android |
| P0-03 | Legal/publisher | Pravi rukovalac, podrška, odobreni rokovi čuvanja, processor map, javni `/privacy`, `/terms`, `/support`, `/delete-account` |
| P0-04 | Account deletion | Pravi web + in-app tok na istom production backendu, disposable user Auth/Storage/ordinary-content E2E, scoped exceptions, sessions revoked |
| P0-05 | UGC i AI | Prvi-use Terms/age flow, prijava+blokiranje i moderacija, eksplicitno obaveštenje/pristanak za AI provider, prijava AI sadržaja |
| P1-06 | Push paket | Firebase klijent za `rs.uskoci` ili uklanjanje svih neisporučenih push tvrdnji/funkcija |
| P1-07 | Store pitanja i recenzenti | Data Safety/App Privacy, IARC, Play App Access i dva reviewer naloga u istom svetu |
| P1-08 | Play testing | Utvrditi Personal/Organization, 12 opt-in testera 14 uzastopnih dana ako primenljivo, Production Access |
| P1-09 | Produkciona operativa | Monitoring crash/ANR, staged rollout, OTA kompatibilnost, rollback, stvarni dvostrani korisnički tok |
| iOS-10 | Poseban iOS build | Apple Developer nalog, Bundle ID, Xcode 26+/iOS SDK26+, privacy manifest, IPA, iPhone/TestFlight |

**Forenzički nalaz:** `docs/implementation/ui-ux-pass-20261002/evidence/forensic-20261009/release/store-matrix.json` — `NO_GO_PUBLIC_RELEASE_OR_10000_NEW_USERS`.

Zvanično: https://developer.android.com/google/play/requirements/target-sdk ; https://developer.android.com/guide/practices/page-sizes ; https://developer.apple.com/news/upcoming-requirements/
