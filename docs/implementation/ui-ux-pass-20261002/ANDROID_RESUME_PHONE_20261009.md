# Android: nastavak AI razgovora i fizički telefon, 09.10.2026.

## Zaključak ograničenog paketa

**R09 je popravljen za otvoren, još neobjavljen razgovor o zadatku.** Početna sada nudi „Nastavi razgovor o zadatku“. Razgovor je na fizičkom HONOR-u preživeo nadogradnju i force-stop/restart; vratili su se ista poruka i nerešena lokacija. To nije potvrda svih AI, glasovnih ili poslovnih tokova, niti promena ukupnog NO-GO zaključka audita.

## URADIO

- Kanonski checkout/branch: `USKOCI-CLEAN-spoj-20261006`, `integration/spoj-20261006`. Pre rada povučen noviji `9e1e27fc` iz kanonske UI grane; njegov phone-consent paket nije ponovo primenjivan. Implementacija ovog paketa je `b9f734efb88f9eda0f732153770dbb48cbd0c7e8`.
- Home čita samo metapodatke postojećih sopstvenih OPEN / NEED_INTAKE / NEED_FACT_V2 razgovora bez objavljenog zadatka, kroz postojeći RLS i account/revision guard. Stranice imaju 20 redova i mikrosekundni keyset cursor; nema novog backend sistema.
- Jedan razgovor otvara se direktno, više razgovora u postojećem ProductSheet-u. Greška ima pokušaj ponovo; nije predstavljena kao prazna lista. Kasni odgovor/izbor posle zatvaranja, promene naloga, gubitka fokusa i pozadine ne sme da otvori pogrešan razgovor. Ruta ponovo proverava trenutno serversko stanje.
- Popravljen zastareli G04-5 source-marker test iz audita: sada proverava aktuelni ugovor obaveznih polja; opciona matching polja nisu vraćena među obavezna. Nije menjana AI poslovna logika.
- Izgrađen, attestiran i instaliran ARM64 preview APK, isključivo `adb install -r`. Nema brisanja podataka, odjave, resetovanja baze, promene zavisnosti, migracije ili Edge deploy-a u ovom paketu.

## DOKAZAO

- TypeScript exit 0; 270 ciljanih i 193 dodatna ugovorna/dizajn testa PASS. Završna kompletna provera: **605/605 suite, 13.501 PASS, 9 SKIPPED, 0 FAIL; 6 snapshot-a PASS**. Preskočeni testovi nisu dokaz. Nezavisni read-only pregled nema blokirajući nalaz ovog paketa.
- APK SHA256 `55be82dc3c09de5371b9295b7977b75fa82ff098d86ec3d7e6f8db404c3a7e5c`, 99.677.208 bytes; 5.949 source fajlova jednako Git arhivi. Preview paket `rs.uskoci.preview`, 1.0.0/35, Android Debug testni sertifikat SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. To nije produkcioni potpis.
- Fizički HONOR VKP-NX9, Android 16/API36, 1264×2728, font 1.15: instalirani hash jednak artefaktu, About prikazuje `b9f734e`. UID i first-install vreme jednaki pre i posle; prijavljena sesija ostala.
- Pre popravke na ce23 pokrenut jedan ograničen probni AI razgovor. Uspešan AI odgovor bio je sačuvan, ali Home nije nudio povratak. Posle b9 nadogradnje nova stavka vraća isti razgovor; posle force-stop/restart-a radi opet. Readback: OPEN, bez objavljenog zadatka, početna korisnička poruka postoji tačno jednom.
- U nastavljenom razgovoru: otvorena velika mapa, izabrana tačka i potvrđeno „Da, ovo je mesto zadatka“. Server čuva jednu važeću `need.resolved_location`, CONFIRMED / EXPLICIT_USER_ANSWER / MANUAL_PIN, i potvrđenu geografiju. Tek posle potvrde dolazi pitanje o broju ljudi. Tačna QA lokacija/ID ostaju u privatnom readback-u, ne u javnoj tabli.
- Nazivi ulica postoje na fizičkom telefonu: ce23 Discovery i b9 mapa AI lokacije. Raniji nedostatak simbola na emulatoru nije time popravljen. Na ce23 pregledani map/list povlačenje, filteri/Back, Home, prazni Dogovori/Poruke i ulaz u radni profil; ti dokazi ostaju vezani za ce23.
- Snimci, XML, test logovi i njihove SHA vrednosti: `evidence/android-resume-phone-20261009/receipt.json`. Izvorne slike sa profilom i sirovi backend podaci ostaju privatno lokalno. Telefon je ostavljen na Početnoj; probni razgovor nije objavljen.

## NIJE DOKAZANO / nalazi koji ostaju

1. **Povremen beli About ekran:** na ce23 ponovljeni warm VIEW link posle niza navigacija dva puta daje prazno telo; proces ostaje živ, Back vraća Home, normalan Profil → O aplikaciji radi. Minimalno ponavljanje kasnije nije izazvalo kvar, a b9 prvo otvaranje radi. Nema dokazanog uzroka ili popravke. Shift/detach je samo kandidat, ne dijagnoza; bez globalnog isključivanja native detach-a.
2. Vizuelni/microcopy nalaz: geocoder vraća predug administrativni opis, a stvarni AI koristi „posao“ umesto doslednog „zadatak“. Ne menjati provider odgovor samo u prikazu; Edge prompt zahteva svoj ograničen paket. Screen-reader hint Home retry-a može jasnije izgovoriti konkretnu radnju; nije blokirao ovaj native tok.
3. Više razgovora/paging/account race ima source testove, ne stvarni native višekorisnički dokaz. Nema nove provere glasa, slike, svih ruta, izmena/objave, dve strane, grupnih poruka ili novog push-a. Ranije vlasnikovo MESSAGE push prihvatanje ostaje zasebno.
4. Nije meren produkcioni kapacitet, P95 network ili korisnici/s. Usputni gfxinfo nije kontrolisan benchmark. Nema iOS ili Google Play spremnosti.
5. Raniji GitHub run 37967025103 nije pokrenuo posao: anotacija navodi neuspele account uplate ili spending limit. Kasniji source-ekvivalentni `5fd6ee64` run-ovi 37973737055 (EX-06E, uključujući Full regression) i 37973736906 (P5, uključujući Full Jest) završili su SUCCESS. Ranija prepreka nije dokaz da CI i dalje ne može da radi. Nije menjana naplata; puni lokalni i CI dokazi ostaju odvojeni.
6. Profil na telefonu prikazuje da pravila i saglasnosti još nisu objavljeni. Pravni dokumenti, izvoz/brisanje naloga, production AAB/potpis/okruženje i povezani release gate-ovi ostaju otvoreni.

## SLEDEĆE

Unutar postojećih B04/B05 redova: dok se učitavaju novi filteri/oblast, stara mapa/lista ostaju, ali novi kriterijumi ne smeju delovati kao već potvrđeni rezultat. Povezati postojeće pending stanje sa jasnim „Osvežavamo zadatke…“, bez novog request vlasnika i bez uklanjanja mape. Zatim nastaviti pet konačnih paketa iz postojećeg audita. Dobre ekrane i poslovna pravila ne redizajnirati bez konkretne greške. Automatizacija na 30 minuta ostaje PAUSED.

Naknadni završetak: B04/B05 pending signal i Home accessibility hint rešeni su u `725be7bd`, uz 600 ciljanih testova i fizički telefon. Videti [završni dokaz](ANDROID_DISCOVERY_PENDING_20261009.md). Istorijski b9 receipt ostaje neizmenjen. Nije ponovo proglašen ceo proizvod prihvaćenim.
