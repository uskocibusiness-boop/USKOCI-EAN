# Završni paket kontinuiteta — 8.10.2026

## URADIO / SOURCE

Polazni HEAD a6504718. Postojeći proizvod, isti RPC i autoritet baze.

- Discovery: „Na daljinu“ prva kapsula; kratko jednoredno polje pretrage; neuspeo P6 pregled ima ponovni pokušaj uz sačuvane izbore. P6 ne računa lokalne rezultate koje odbacuje; promena omotača čuva memoizaciju liste/pinova.
- Moje prijave: poslednja stranica ne sklanja filtere i ne pregrupiše kartice pod prstom. Moji zadaci: reset filtera ostaje u nacrtima/istoriji u kojoj se korisnik nalazi.
- Dogovori: Sve / Tražim pomoć / Uskačem iz stvarne sopstvene uloge; isti filter kroz aktivne/istoriju, očuvan pri povratku, poništen pri promeni naloga. Profilov ukupni broj završenih otvara sve uloge i uklanja prethodna suženja; eksplicitni parametar se troši jednom.
- Profil: duže statusne rečenice ispod naslova, ne u uskoj desnoj koloni.
- Radni AI: zatvoren razgovor ne nudi unos. Uvod i ručna polja jasno obuhvataju svakodnevnu pomoć, bez automatskog dodavanja veština.
- Grupni razgovor: potvrđeno slanje automatski nastavlja stvarno čitanje. Neizvestan ishod čuva postojeći ključ; neuspeo lokalni cleanup zadržava potvrdu i retry samo čitanja. Neposlat nacrt ostaje u memoriji iste montirane konverzacije kroz background/focus; promena naloga/revizije/grupe/dozvole ga uklanja. Bez plaintext zapisa na disk. Render koristi indeks liste umesto ponovnog pretraživanja svih poruka.

## DOKAZAO

- TEST: 6 ciljanih grupa / 380 testova PASS, zatim 9 grupa / 416 testova PASS. Završna dopuna eksplicitnog ulaza u istoriju: route grupa 24/24 PASS (prethodno 23). To je 797 različitih testova u 15 grupa, ne zbir sa ponavljanjem.
- TEST: TypeScript PASS i posle poslednje dopune eksplicitnog ulaza u istoriju.
- SOURCE: nezavisni read-only pregledi Discovery, ličnog rada i grupnog razgovora; pronađen i ispravljen profil→filtrirana istorija propust.
- DEV: read-only checkpoint 235 / 3a785d42; nema server promene.
- PHONE: postojeći APK 4e0ea506, package rs.uskoci.preview, versionCode35, SHA256 7122b1c22073af4f4b38330e22115dbf02536cef0072092502aa19fa06d2fea1. POST_NOTIFICATIONS granted=true. To nije dokaz novih izmena.
- DEV push: total_devices2 / active_devices1 / active_android_devices1 / active_session_bound_devices1, last_seen_at 2026-10-08T21:18:55.080965Z. Nisu čitane vrednosti tokena. Sama registracija ne dokazuje dostavu.
- EMULATOR: USKOCI_V5_TEST pokrenut, Android16,1264×2728/560dpi/font1.15; postojeći preview APK SHA256 3f78e4e9943233e9c43fb7a9b128c71e127b6ed8e90068e3298fa9bd6601c6c7. Novi paket još nije instaliran.

## NIJE DOKAZANO

Novi native izgled/motion; cela objava→ocene na dva naloga; nova voice/push dostava; AI kompletna ruta; hiljade istovremenih korisnika; prodavnica. Radni AI ne pita još sistematski o svakodnevnim zadacima; sinonimi poput „pomoć sa kesama“ nisu garantovano pokriveni matchingom. Nema novih automatskih kategorija/opt-in polja.

## SLEDEĆE

Tačan emulator/phone APK ovog paketa → instalacija-r uz isti potpis i podatke → ograničene slike/tokovi → korekcija stvarnih nalaza. Push transport: kapacitet i single-target dokaz pre kontrolisane dostave. AI pitanja/sinonimi zasebno uz existing server contracts. Lokalna kontrolna tabla se osvežava; objavljena Claude tabla nije time republished.


## Dopuna — reference i neprekinuto povlačenje liste

**URADIO / SOURCE:** vizuelne reference14395–14424 prevedene u konkretne kriterijume svih površina u postojećem NACRT-u §16.8. Nađen stvaran gesture sukob: Gorhom5.2.14 na FULL rezerviše content drag za refresh čim lista ima `onRefresh` (`createBottomSheetScrollableComponent`, `useGestureEventsHandlersDefault`). Discovery više ne daje taj prop; povlačenje nadole pripada sheet-u. Redovno osvežavanje ostaje Još mogućnosti → Osveži zadatke, a recovery radnje ostaju iste. Ne menjaju se biblioteka, cache/reader, kamera, privatnost ili server.

**DOKAZAO / TEST:** novi regresioni test FAIL pre izmene (onRefresh prisutan), zatim cela Discovery presentation grupa212/212 PASS; TypeScript PASS. Provereno da eksplicitno osvežavanje čuva query/filtere/visinu, a callback prethodnog mount-a ne može da osveži novi ili poništi njegovo vraćanje scroll-a. Ovo su provere source integracije, ne emulacija fizičkog prsta.

**NIJE DOKAZANO:** neprekinuti native gest na APK-u sa ovom naknadnom izmenom. Buildovi37846681465 (emulator) i37846682483 (telefon) pripadaju ranijem source6dbd38e0; ne sadrže ovu dopunu. Map/tablet/performance/whole-app/store tvrdnje nisu zatvorene. Posebno proveriti važnu lokacijsku/Za mene poruku na FULL, floating Mapa preko srednjih redova i pojavu tabova tokom zadržanog draga.

**SLEDEĆE:** tačan novi APK uz postojeći redosled build→slika/snimak→kritika→korekcija. Native proba: HALF→FULL→scroll, scroll→vrh→spuštanje, kratka/prazna lista, detalj→Back, font1.15, reduced motion i dostupnost poslednje kartice. Nova autonomija ne menja oznake nivoa dokaza.
