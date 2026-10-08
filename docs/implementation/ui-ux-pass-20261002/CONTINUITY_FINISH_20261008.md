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


## Dopuna — jasni duboki redovi profila i privatnosti

**URADIO / SOURCE:** „Grad“ u Ličnim podacima zove se „Područje rada“, jer postojeći reader čita work.data.grad i postojeća radnja otvara /profil/lokacija. Sačuvani su isti podaci, read/retry stanja i navigacijska zaštita. Vrednost stoji ispod naziva; isti raspored dobili su Izvoz podataka, Blokirane osobe i Pravila i saglasnosti u Privatnosti. Nema novih privatnosnih opcija niti promene njihove semantike. U ovom paketu nisu konsolidovani duplirani ulazi sa Profila; to ostaje pitanje kompozicije narednog vizuelnog pregleda.

**DOKAZAO / TEST:** postojeće tri grupe (personal-profile-route, profile-edit-render, privacy-retention-screen)93/93 PASS nakon usaglašavanja selektora sa novim nazivom. Zadržane provere navigacije, ponovnog ulaza, nedostupnih/nepročitanih podataka i retention prikaza. Nisu dodati paralelni rendereri ni novi testni framework.

**NIJE DOKAZANO:** native prikaz ove naknadne dopune. Aktivni buildovi37848305665 /37848305939 su source dce7c463 i sadrže gesture fix; ne sadrže ovu kasniju doradu dubokih redova. Raniji6dbd buildovi ne dokazuju ni novi gesture fix.

**SLEDEĆE:** uključiti ove uske vizuelne korekcije u sledeći objedinjeni APK i pregledati iste deep-screen scene pri1.15 fontu. Fizičke i sintetičke probe ostaju odvojeno označene.

Nezavisni SOURCE pregled ove dopune pronašao je gramatičko slaganje fallback-a sa novim nazivom: sada „Trenutno nedostupno“ / „Još nije podešeno“. Ponovna provera route + postojećeg formattera39/39 PASS (preklapa se sa gore navedenih93; ne sabirati kao nove testove). TypeScript PASS.


## Dopuna — fiksna oznaka izvora mape (09.10)

**URADIO / SOURCE:** prema poslednjoj odluci vlasnika, mali natpis izvora ostaje dole levo uz spuštenu listu. Nema animiranog podizanja za listom ili karticom pina; te površine ga prirodno prekrivaju. Prekrivena kontrola uklanja se iz dodira i navigacije čitača ekrana. Isti ugovor primenjen je u native i web komponenti. Izvori i linkovi sačuvani, kamera i Moja lokacija ne menjaju ponašanje.

**DOKAZAO / TEST:** discovery-map + discovery-presentation, 2 grupe / 266 testova PASS; TypeScript PASS nakon usaglašavanja web poziva. Nezavisni read-only pregled pronašao je stari web potpis, ispravljen pre završne provere. Granica: stanje dostupnosti kontrole tokom samog draga prati poslednji potvrđeni sheet indeks; konačni HALF/FULL i prikaz kartice ga isključuju.

**DOKAZAO / APK:** raniji buildovi37846681465 /37846682483 završeni uspešno. Preuzeti APK-ovi source6dbd38e0: emulator SHA256 ad65bee27d0876132e45f8975a881bcf03d33373ee886ecf5318754991171d69; telefon SHA256 6b610fe29214443a496f93368179497e181ae062d3f60d53f54680c4af498d2d. Potpis direktno pročitan iz oba trenutno instalirana preview APK-a i novih artefakata: SHA256 fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c. Nema razlike potpisa; raniji kratki dumpsys identifikator nije SHA256 sertifikata. Provera sama ne znači instalaciju.

**NIJE DOKAZANO:** poslednja kompozicija oznake i dubokih redova na native APK-u. Raniji6dbd artefakti ne sadrže ove dopune ni gesture fix. Dce7 buildovi sadrže samo raniji gesture fix. Nema nove serverske primene, dostave push-a ili dokaza spremnosti za prodavnicu.

**SLEDEĆE:** objedinjeni APK sa ovom izmenom i profilom/privatnošću; proveriti COMPACT/HALF/FULL i pin karticu, zatim nativni gest i povratak. Instalacija isključivo preko postojećeg paketa uz očuvane podatke.
