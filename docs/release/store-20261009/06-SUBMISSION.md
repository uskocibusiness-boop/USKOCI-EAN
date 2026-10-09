# Postupak unosa u Google Play i Apple App Store

## Google Play (prvi praktični cilj)

1. U Play Console potvrditi tip naloga **Personal/Organization**, status Production Access i već poslatu potvrdu identiteta od 5.10.2026.
2. Kreirati ili pronaći Android aplikaciju `USKOČI`, potvrditi trajni package `rs.uskoci`; ispuniti App Content i pravni operator identity.
3. Odobriti/javno objaviti Terms, Privacy, Safety, Support i deletion URL. U aplikaciji aktivirati i proveriti mandatory first-use acceptance, AI privacy disclosure/reporting i obrade podrške.
4. Isključiti DEV svet: pripremiti izolovan production backend, source-bound EAS environment, signed AAB i proći finalne tehničke testove (API36, 16 KB, Firebase/push ili pošteno disable).
5. Iz ovog paketa kopirati samo verifikovane opise; popuniti Data Safety, IARC/target audience, Content declarations, App Access za 2 reviewer naloga.
6. Internal Testing sa potpisanim AAB. Ako je relevantno, Closed Testing 12×14, pa zahtev za Production Access. Zatim pažljivi rollout i monitoring.

Komanda tek posle prelaska P0: `npx eas-cli build --profile production --platform android`.

## Apple (zaseban release)

1. Apple Developer Program: potvrditi aktivnu prijavu i seller name (Individual/Organization).
2. Zasebno konfigurisati trajni `ios.bundleIdentifier`, iOS EAS build profile i signing credentials. Trenutni `scripts/check-eas-preview.cjs` namerno odbija iOS; mora reviewed promena na app grani.
3. Xcode26+/iOS26 SDK, pravi signed IPA i TestFlight, iPhone uređaji, App Privacy, Required Reason API / privacy manifest, legal/AI/report/closure dokazi.
4. English primary App Store Connect tekst iz ovog paketa; Support/Privacy URL; stvarni iPhone screenshots, age rating, App Review demo.
5. Tek onda App Review.

## Vlasnik mora da potvrdi (ne izmišljati)

- Pravni oblik i identitet operatora, javnu poslovnu/poštansku adresu kad je zakonski potrebna, odgovornu osobu.
- Aktivni support/privacy/abuse email i obradu zahteva.
- Retention izuzetke i rokove: Dogovori, safety, support, AI, logs/backups.
- Google Play account type i Production Access status; uzrast/target audience i finalne države.
- Apple Developer status, Individual/Organization, stalni iOS Bundle ID.
- Dva funkcionalna review naloga unutar bezbedne console.
- Potvrdu produkcione izolacije i pravnog teksta.

Do tada je status **NO-GO PUBLIC RELEASE**, a ne „sve gotovo”.
