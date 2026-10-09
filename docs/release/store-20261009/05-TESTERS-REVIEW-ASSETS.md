# Realni testeri, review nalozi i screenshotovi

## Dva review naloga

- A: korisnik objavljuje zadatak; B: korisnik pronalazi zadatak i šalje prijavu.
- Oba u **istom release svetu**, potvrdjeni emailovi, samo fiktivni podaci i javne približne lokacije.
- Scenarij: A objava → B mapa/lista → B prijava → A izbor → Dogovor → poruke → završetak/ocena.
- Recenzent takođe mora lako da pronađe: report/block, Privacy, Terms, permission decline, Support i Account deletion.
- Credentials se unose **samo u Play Console / App Store Connect**; ne u Git/chat.

## 12×14 Play requirement

Ako je Play nalog novi Personal nalog koji podleže pravilu, potrebno je najmanje **12 stvarnih opt-in testera tokom 14 neprekidnih dana** pre prijave za Production Access. Planirati 15 radi rezerve. Prihvaćen novi AAB u Closed Testing, testeri igraju stvarne tokove i vraćaju feedback; automatski botovi nisu zamena. Verifikacija identiteta 5.10. nije dokaz ispunjenog testa.

Official: https://support.google.com/googleplay/android-developer/answer/14151465

## Screenshot checklist (isti potpisani release kandidat)

| Red | Ekran | Dokaz |
|---|---|---|
| S1 | Početna | Objavi zadatak, Uskoči i zaradi |
| S2 | AI unos | stvarni tekst/voice tek kada provider radi |
| S3 | Pregled pre objave | bez privatne tačne adrese |
| S4 | Mapa + pin + sheet | stvarni tiles i atribucija |
| S5 | Detalj zadatka | title/time/place/people/prijava |
| S6 | Prijava i potvrda | stvarna server potvrda |
| S7 | Dogovor | prihvaćeni uslovi |
| S8 | Poruke | bez privatnih podataka i stvarnih korisnika |
| S9 | In-app notifikacije | ne tvrditi da push radi bez proof |
| S10 | Radni profil | skills, alat, vozilo, dostupnost |

Google Play: odobren logo icon 512×512 PNG, feature graphic 1024×500 i 2–8 realnih telefonskih screenshotova. Apple: iz **pravog iOS builda** iPhone screenshotovi propisanih dimenzija, ne Android prepakovan kao iOS.

Fizički QA: first install/update, cold start, login/registracija/recovery, dva naloga, map/list/filter/Back, 16 KB, offline/svež token, AI error, location denial, media, push, report/block, closure disposable.

Official screenshots: https://support.google.com/googleplay/android-developer/answer/9866151 ; https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
